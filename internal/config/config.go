package config

import (
	"fmt"
	"os"

	"github.com/joho/godotenv"
)

// Config holds all application configuration.
// Immutable after initialization.
type Config struct {
	MongoURI            string
	DBName              string
	LogLevel            string
	HFAPIKey            string
	HFIntentModel       string
	HFNERModel          string
	SessionTimeout      int
	SessionDir          string
	WAMaxRetries        int
	WABackoffMultiplier float64
	WAReplyOnError      bool
}

// Load reads configuration from environment variables.
// Loads .env file if present, validates all required fields.
// Returns error if validation fails (fail fast).
func Load() (*Config, error) {
	// Load .env if exists (ignore error if not present)
	_ = godotenv.Load()

	cfg := &Config{
		MongoURI:            getEnv("MONGO_URI", ""),
		DBName:              getEnv("DB_NAME", "clara"),
		LogLevel:            getEnv("LOG_LEVEL", "info"),
		HFAPIKey:            getEnv("HF_API_KEY", ""),
		HFIntentModel:       getEnv("HF_INTENT_MODEL", "neuralmind/bert-base-portuguese-cased"),
		HFNERModel:          getEnv("HF_NER_MODEL", "pierreguillou/ner-bert-base-cased-pt-lenerbr"),
		SessionTimeout:      getEnvInt("SESSION_TIMEOUT", 900), // 15 min default
		SessionDir:          getEnv("SESSION_DIR", "tmp/whatsapp_session"),
		WAMaxRetries:        getEnvInt("WA_MAX_RETRIES", 5),
		WABackoffMultiplier: getEnvFloat("WA_BACKOFF_MULTIPLIER", 2.0),
		WAReplyOnError:      getEnvBool("WA_REPLY_ON_ERROR", true),
	}

	if err := cfg.validate(); err != nil {
		return nil, fmt.Errorf("config validation failed: %w", err)
	}

	return cfg, nil
}

// validate checks required fields are set.
func (c *Config) validate() error {
	if c.MongoURI == "" {
		return fmt.Errorf("MONGO_URI is required")
	}
	if c.HFAPIKey == "" {
		return fmt.Errorf("HF_API_KEY is required")
	}
	return nil
}

// getEnv retrieves env var with fallback.
func getEnv(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

// getEnvInt retrieves env var as int with fallback.
func getEnvInt(key string, fallback int) int {
	if value := os.Getenv(key); value != "" {
		var i int
		if _, err := fmt.Sscanf(value, "%d", &i); err == nil {
			return i
		}
	}
	return fallback
}

// getEnvFloat retrieves env var as float64 with fallback.
func getEnvFloat(key string, fallback float64) float64 {
	if value := os.Getenv(key); value != "" {
		var f float64
		if _, err := fmt.Sscanf(value, "%f", &f); err == nil {
			return f
		}
	}
	return fallback
}

// getEnvBool retrieves env var as bool with fallback.
func getEnvBool(key string, fallback bool) bool {
	if value := os.Getenv(key); value != "" {
		return value == "true" || value == "1" || value == "yes"
	}
	return fallback
}
