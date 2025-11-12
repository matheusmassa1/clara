package nlp

import (
	"context"
	"fmt"
	"strings"

	"github.com/rs/zerolog/log"
)

const (
	// ConfidenceThreshold is the minimum confidence score for intent/entities.
	ConfidenceThreshold = 0.7

	// MaxTextLength is the maximum allowed input text length (HF API limit).
	MaxTextLength = 400
)

// Service defines the NLP processing interface.
type Service interface {
	Process(ctx context.Context, text string) (*NLPResult, error)
}

// service implements the Service interface using HF API.
type service struct {
	client            *HFClient
	confidenceThresh  float64
}

// NewService creates a new NLP service with the given configuration.
func NewService(apiKey, intentModel, nerModel string) (Service, error) {
	client, err := NewHFClient(apiKey, intentModel, nerModel)
	if err != nil {
		return nil, fmt.Errorf("failed to create HF client: %w", err)
	}

	return &service{
		client:           client,
		confidenceThresh: ConfidenceThreshold,
	}, nil
}

// Process analyzes input text and extracts intent and entities.
func (s *service) Process(ctx context.Context, text string) (*NLPResult, error) {
	// Validate input
	text = strings.TrimSpace(text)
	if text == "" {
		log.Warn().Msg("empty input text")
		return nil, ErrInvalidInput
	}

	if len(text) > MaxTextLength {
		log.Warn().
			Int("length", len(text)).
			Int("max", MaxTextLength).
			Msg("text exceeds max length")
		return nil, ErrTextTooLong
	}

	// Classify intent
	intentResult, err := s.client.ClassifyIntent(ctx, text)
	if err != nil {
		log.Error().
			Err(err).
			Str("text", text).
			Msg("failed to classify intent")
		return nil, fmt.Errorf("%w: %v", ErrAPIFailure, err)
	}

	// Extract entities
	entities, err := s.client.ExtractEntities(ctx, text)
	if err != nil {
		log.Error().
			Err(err).
			Str("text", text).
			Msg("failed to extract entities")
		return nil, fmt.Errorf("%w: %v", ErrAPIFailure, err)
	}

	// Filter entities by confidence threshold
	filteredEntities := make([]Entity, 0, len(entities))
	for _, entity := range entities {
		if entity.Confidence >= s.confidenceThresh {
			filteredEntities = append(filteredEntities, entity)
		}
	}

	// Check if confidence is below threshold
	lowConfidence := intentResult.Confidence < s.confidenceThresh

	result := &NLPResult{
		Intent:        intentResult,
		Entities:      filteredEntities,
		LowConfidence: lowConfidence,
	}

	log.Info().
		Str("intent", string(intentResult.Intent)).
		Float64("confidence", intentResult.Confidence).
		Int("entities", len(filteredEntities)).
		Bool("low_confidence", lowConfidence).
		Msg("nlp processing complete")

	return result, nil
}
