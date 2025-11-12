package main

import (
	"os"

	"github.com/matheusmassa1/clara/internal/config"
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

	log.Info().Msg("Clara initialized successfully. Exiting for now...")
}
