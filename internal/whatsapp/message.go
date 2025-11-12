package whatsapp

import (
	"go.mau.fi/whatsmeow/types/events"
)

// handleMessage processes incoming WhatsApp messages.
// Filters: 1-on-1 only (ignores groups).
// Echo handler: replies with "Echo: {text}".
func (c *Client) handleMessage(evt *events.Message) {
	// Ignore group messages (only process 1-on-1 chats)
	// s.whatsapp.net = regular 1-on-1
	// lid = WhatsApp Business 1-on-1
	// g.us = groups (ignore)
	if evt.Info.Chat.Server != "s.whatsapp.net" && evt.Info.Chat.Server != "lid" {
		c.logger.Info().
			Str("server", string(evt.Info.Chat.Server)).
			Msg("ignoring non-1-on-1 message")
		return
	}

	// Ignore user's own outgoing messages
	if evt.Info.IsFromMe {
		c.logger.Info().Msg("ignoring own message")
		return
	}

	// Extract message text
	text := evt.Message.GetConversation()
	if text == "" {
		// Try extended text message
		if evt.Message.ExtendedTextMessage != nil {
			text = evt.Message.ExtendedTextMessage.GetText()
		}
	}

	// Ignore empty messages
	if text == "" {
		c.logger.Info().Msg("ignoring empty message")
		return
	}

	c.logger.Info().
		Str("from", evt.Info.Sender.String()).
		Str("text", text).
		Msg("received message")

	// Echo handler: reply with "Clara: Testing"
	reply := "Clara: Testing"

	if err := c.SendText(evt.Info.Sender, reply); err != nil {
		c.logger.Error().
			Err(err).
			Str("from", evt.Info.Sender.String()).
			Msg("failed to send echo reply")

		// If configured, send error reply to user
		if c.cfg.WAReplyOnError {
			errReply := "Erro ao processar mensagem"
			if sendErr := c.SendText(evt.Info.Sender, errReply); sendErr != nil {
				c.logger.Error().
					Err(sendErr).
					Msg("failed to send error reply")
			}
		}
		return
	}

	c.logger.Debug().
		Str("to", evt.Info.Sender.String()).
		Str("reply", reply).
		Msg("echo reply sent")
}
