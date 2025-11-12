package whatsapp

import (
	"context"
	"fmt"
	"os"
	"time"

	"github.com/rs/zerolog"
	qrcode "github.com/skip2/go-qrcode"
	"go.mau.fi/whatsmeow"
	waProto "go.mau.fi/whatsmeow/binary/proto"
	"go.mau.fi/whatsmeow/store/sqlstore"
	"go.mau.fi/whatsmeow/types"
	"go.mau.fi/whatsmeow/types/events"
	waLog "go.mau.fi/whatsmeow/util/log"
	"google.golang.org/protobuf/proto"

	"github.com/matheusmassa1/clara/internal/config"
)

// Client wraps whatsmeow client with app-specific logic.
type Client struct {
	client *whatsmeow.Client
	cfg    *config.Config
	logger zerolog.Logger
	store  *sqlstore.Container
}

// New creates WhatsApp client instance.
// Initializes SQLite store for session persistence.
func New(cfg *config.Config, logger zerolog.Logger) (*Client, error) {
	// Setup store
	dbLog := waLog.Stdout("Database", "ERROR", true)
	ctx := context.Background()
	store, err := sqlstore.New(ctx, "sqlite3", fmt.Sprintf("file:%s/session.db?_foreign_keys=on", cfg.SessionDir), dbLog)
	if err != nil {
		return nil, fmt.Errorf("failed to create session store: %w", err)
	}

	return &Client{
		cfg:    cfg,
		logger: logger,
		store:  store,
	}, nil
}

// Connect establishes WhatsApp connection.
// Displays QR code if not authenticated, persists session.
func (c *Client) Connect() error {
	// Create session dir
	if err := os.MkdirAll(c.cfg.SessionDir, 0700); err != nil {
		return wrapNetworkError(err, "failed to create session dir")
	}

	// Get first device (or create new)
	ctx := context.Background()
	deviceStore, err := c.store.GetFirstDevice(ctx)
	if err != nil {
		return wrapProtocolError(err, "failed to get device")
	}

	// Create client
	clientLog := waLog.Stdout("Client", "ERROR", true)
	c.client = whatsmeow.NewClient(deviceStore, clientLog)
	c.client.AddEventHandler(c.eventHandler)

	// Check if already logged in
	if c.client.Store.ID == nil {
		// Not logged in, need QR auth
		c.logger.Info().Msg("no session found, displaying QR code")

		qrChan, _ := c.client.GetQRChannel(context.Background())

		if err := c.client.Connect(); err != nil {
			return wrapNetworkError(err, "failed to connect")
		}

		for evt := range qrChan {
			if evt.Event == "code" {
				// Display QR in terminal
				if err := c.displayQR(evt.Code); err != nil {
					c.logger.Error().Err(err).Msg("failed to display QR")
					fmt.Println("QR code:", evt.Code)
				}
			} else {
				c.logger.Info().Str("event", evt.Event).Msg("qr channel event")
			}
		}
	} else {
		// Already logged in, just connect
		c.logger.Info().
			Str("jid", c.client.Store.ID.String()).
			Msg("existing session found")

		if err := c.client.Connect(); err != nil {
			return wrapNetworkError(err, "failed to connect")
		}
	}

	c.logger.Info().Msg("whatsapp connected")
	return nil
}

// Disconnect gracefully disconnects client.
func (c *Client) Disconnect() {
	if c.client != nil {
		c.logger.Info().Msg("disconnecting whatsapp client")
		c.client.Disconnect()
	}
	if c.store != nil {
		if err := c.store.Close(); err != nil {
			c.logger.Error().Err(err).Msg("failed to close store")
		}
	}
}

// SendText sends text message to JID.
func (c *Client) SendText(jid types.JID, text string) error {
	if c.client == nil || !c.client.IsConnected() {
		return ErrDisconnected
	}

	_, err := c.client.SendMessage(context.Background(), jid, &waProto.Message{
		Conversation: proto.String(text),
	})
	if err != nil {
		if isNetworkError(err) {
			return wrapNetworkError(err, "failed to send message")
		}
		return wrapProtocolError(err, "failed to send message")
	}

	c.logger.Debug().
		Str("jid", jid.String()).
		Str("text", text).
		Msg("message sent")

	return nil
}

// Reconnect attempts reconnection with exponential backoff.
// Retries up to WAMaxRetries times.
// Returns error if all retries exhausted.
func (c *Client) Reconnect() error {
	c.logger.Info().Msg("attempting reconnect")

	backoff := 1 * time.Second

	for i := 0; i < c.cfg.WAMaxRetries; i++ {
		c.logger.Info().
			Int("attempt", i+1).
			Int("max", c.cfg.WAMaxRetries).
			Dur("backoff", backoff).
			Msg("reconnecting")

		// Disconnect first
		if c.client != nil {
			c.client.Disconnect()
		}

		// Try connect
		err := c.Connect()
		if err == nil {
			c.logger.Info().Msg("reconnect successful")
			return nil
		}

		// Check if protocol error (don't retry)
		if isProtocolError(err) {
			c.logger.Error().Err(err).Msg("protocol error, giving up")
			return err
		}

		// Network error, retry with backoff
		c.logger.Warn().
			Err(err).
			Dur("backoff", backoff).
			Msg("connect failed, retrying")

		time.Sleep(backoff)

		// Exponential backoff with cap at 30s
		backoff = time.Duration(float64(backoff) * c.cfg.WABackoffMultiplier)
		if backoff > 30*time.Second {
			backoff = 30 * time.Second
		}
	}

	return fmt.Errorf("reconnect failed after %d attempts", c.cfg.WAMaxRetries)
}

// eventHandler processes WhatsApp events.
func (c *Client) eventHandler(evt interface{}) {
	switch v := evt.(type) {
	case *events.Message:
		c.handleMessage(v)
	case *events.Connected:
		c.logger.Info().Msg("whatsapp connected event")
	case *events.Disconnected:
		c.logger.Warn().Msg("whatsapp disconnected event")
		// Trigger reconnect
		go func() {
			if err := c.Reconnect(); err != nil {
				c.logger.Error().Err(err).Msg("reconnect failed")
			}
		}()
	case *events.StreamError:
		c.logger.Error().
			Interface("error", v).
			Msg("stream error")
	default:
		// Ignore other events
	}
}

// displayQR displays QR code in terminal.
func (c *Client) displayQR(code string) error {
	qr, err := qrcode.New(code, qrcode.Medium)
	if err != nil {
		return err
	}

	fmt.Println("\n" + qr.ToSmallString(false))
	fmt.Println("Scan QR code above with WhatsApp")

	return nil
}
