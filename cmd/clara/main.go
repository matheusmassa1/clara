package main

import (
	"context"
	"os"
	"os/signal"
	"syscall"

	_ "github.com/mattn/go-sqlite3" // SQLite driver for whatsmeow session storage

	"github.com/matheusmassa1/clara/internal/config"
	"github.com/matheusmassa1/clara/internal/repository/mongo"
	"github.com/matheusmassa1/clara/internal/whatsapp"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
)

func main() {
	// Setup structured logging
	log.Logger = log.Output(zerolog.ConsoleWriter{Out: os.Stderr})

	log.Info().Msg("Starting Clara WhatsApp Assistant")

	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to load configuration")
	}

	// Set log level
	level, err := zerolog.ParseLevel(cfg.LogLevel)
	if err != nil {
		log.Warn().Str("level", cfg.LogLevel).Msg("Invalid log level, using info")
		level = zerolog.InfoLevel
	}
	zerolog.SetGlobalLevel(level)

	log.Info().
		Str("db_name", cfg.DBName).
		Str("intent_model", cfg.HFIntentModel).
		Str("ner_model", cfg.HFNERModel).
		Str("session_dir", cfg.SessionDir).
		Msg("Configuration loaded successfully")

	// Connect to MongoDB
	ctx := context.Background()
	client, db, err := mongo.Connect(ctx, cfg.MongoURI, cfg.DBName)
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to connect to MongoDB")
	}
	defer func() {
		if err := mongo.Disconnect(context.Background(), client); err != nil {
			log.Error().Err(err).Msg("Failed to disconnect from MongoDB")
		}
	}()

	// Ensure indexes exist
	if err := mongo.EnsureIndexes(ctx, db); err != nil {
		log.Fatal().Err(err).Msg("Failed to ensure MongoDB indexes")
	}

	// Create repository instances
	patientRepo := mongo.NewPatientRepository(db)
	appointmentRepo := mongo.NewAppointmentRepository(db)
	_ = patientRepo      // prevent unused variable error (future phases)
	_ = appointmentRepo  // prevent unused variable error (future phases)

	// Initialize WhatsApp client
	waClient, err := whatsapp.New(cfg, log.Logger)
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to create WhatsApp client")
	}
	defer waClient.Disconnect()

	// Connect to WhatsApp (displays QR if needed)
	if err := waClient.Connect(); err != nil {
		log.Fatal().Err(err).Msg("Failed to connect to WhatsApp")
	}

	// Log successful initialization
	log.Info().Msg("Clara initialized successfully - ready to receive messages")

	// Wait for termination signal
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, os.Interrupt, syscall.SIGTERM)
	<-sigCh

	log.Info().Msg("Shutting down Clara...")
}
