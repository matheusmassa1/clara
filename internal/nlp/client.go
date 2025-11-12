package nlp

import (
	"context"
	"fmt"
	"time"

	"github.com/hupe1980/go-huggingface"
	"github.com/rs/zerolog/log"
)

// HFClient wraps Hugging Face API client for NLP inference.
type HFClient struct {
	ic          *huggingface.InferenceClient
	intentModel string
	nerModel    string
}

// NewHFClient creates a new Hugging Face API client.
func NewHFClient(apiKey, intentModel, nerModel string) (*HFClient, error) {
	if apiKey == "" {
		return nil, fmt.Errorf("api key cannot be empty")
	}
	if intentModel == "" {
		return nil, fmt.Errorf("intent model cannot be empty")
	}
	if nerModel == "" {
		return nil, fmt.Errorf("ner model cannot be empty")
	}

	ic := huggingface.NewInferenceClient(apiKey)

	return &HFClient{
		ic:          ic,
		intentModel: intentModel,
		nerModel:    nerModel,
	}, nil
}

// ClassifyIntent classifies user intent using the configured intent model.
func (c *HFClient) ClassifyIntent(ctx context.Context, text string) (IntentResult, error) {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	log.Debug().
		Str("model", c.intentModel).
		Str("text", text).
		Msg("classifying intent")

	// Call text classification endpoint
	resp, err := c.ic.TextClassification(ctx, &huggingface.TextClassificationRequest{
		Model:  c.intentModel,
		Inputs: text,
		Options: huggingface.Options{
			WaitForModel: boolPtr(true),
		},
	})
	if err != nil {
		return IntentResult{}, fmt.Errorf("failed to classify intent: %w", err)
	}

	if len(resp) == 0 || len(resp[0]) == 0 {
		return IntentResult{
			Intent:     IntentUnknown,
			Confidence: 0.0,
		}, nil
	}

	// Get top result
	topResult := resp[0][0]

	// Map label to Intent
	intent := mapLabelToIntent(topResult.Label)

	log.Debug().
		Str("intent", string(intent)).
		Float64("confidence", float64(topResult.Score)).
		Msg("intent classified")

	return IntentResult{
		Intent:     intent,
		Confidence: float64(topResult.Score),
	}, nil
}

// ExtractEntities extracts named entities using the configured NER model.
func (c *HFClient) ExtractEntities(ctx context.Context, text string) ([]Entity, error) {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	log.Debug().
		Str("model", c.nerModel).
		Str("text", text).
		Msg("extracting entities")

	// Call token classification (NER) endpoint
	resp, err := c.ic.TokenClassification(ctx, &huggingface.TokenClassificationRequest{
		Model:  c.nerModel,
		Inputs: text,
		Options: huggingface.Options{
			WaitForModel: boolPtr(true),
		},
	})
	if err != nil {
		return nil, fmt.Errorf("failed to extract entities: %w", err)
	}

	if len(resp) == 0 {
		return []Entity{}, nil
	}

	// Convert HF response to our Entity type
	entities := make([]Entity, 0, len(resp))
	for _, token := range resp {
		entityType := mapLabelToEntityType(token.EntityGroup)
		if entityType == "" {
			// Skip unknown entity types
			continue
		}

		entities = append(entities, Entity{
			Type:       entityType,
			Value:      token.Word,
			Confidence: token.Score,
		})
	}

	log.Debug().
		Int("count", len(entities)).
		Msg("entities extracted")

	return entities, nil
}

// mapLabelToIntent maps HF classification label to our Intent type.
func mapLabelToIntent(label string) Intent {
	// Map common PT-BR intent labels to our types
	// This mapping may need adjustment based on actual model output
	switch label {
	case "schedule", "agendar", "marcar", "schedule_appointment":
		return IntentScheduleAppointment
	case "cancel", "cancelar", "cancel_appointment":
		return IntentCancelAppointment
	case "reschedule", "remarcar", "reschedule_appointment":
		return IntentRescheduleAppointment
	case "check", "verificar", "disponibilidade", "check_availability":
		return IntentCheckAvailability
	default:
		return IntentUnknown
	}
}

// mapLabelToEntityType maps HF NER label to our EntityType.
func mapLabelToEntityType(label string) EntityType {
	// Map NER labels to our entity types
	// Adjust based on actual NER model output
	switch label {
	case "PER", "PESSOA", "person", "name":
		return EntityPatientName
	case "TIME", "DATA", "date", "datetime":
		return EntityDateTime
	case "PHONE", "TEL", "phone":
		return EntityPhone
	case "ORG", "ORGANIZACAO", "service":
		return EntityServiceType
	default:
		return "" // Unknown type
	}
}

func boolPtr(b bool) *bool {
	return &b
}
