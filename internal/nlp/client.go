package nlp

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/rs/zerolog/log"
)

// HFClient wraps Hugging Face API client for NLP inference.
type HFClient struct {
	baseURL     string
	apiKey      string
	intentModel string
	nerModel    string
	httpClient  *http.Client
}

// Request/response types for HF API
type classificationRequest struct {
	Inputs  string                 `json:"inputs"`
	Options map[string]interface{} `json:"options,omitempty"`
}

type classificationResponse []struct {
	Label string  `json:"label"`
	Score float64 `json:"score"`
}

type tokenClassificationResponse []struct {
	EntityGroup string  `json:"entity_group"`
	Score       float64 `json:"score"`
	Word        string  `json:"word"`
	Start       int     `json:"start"`
	End         int     `json:"end"`
}

type hfErrorResponse struct {
	Error string `json:"error"`
}

// NewHFClient creates a new Hugging Face API client.
func NewHFClient(baseURL, apiKey, intentModel, nerModel string) (*HFClient, error) {
	if baseURL == "" {
		return nil, fmt.Errorf("base url cannot be empty")
	}
	if apiKey == "" {
		return nil, fmt.Errorf("api key cannot be empty")
	}
	if intentModel == "" {
		return nil, fmt.Errorf("intent model cannot be empty")
	}
	if nerModel == "" {
		return nil, fmt.Errorf("ner model cannot be empty")
	}

	return &HFClient{
		baseURL:     baseURL,
		apiKey:      apiKey,
		intentModel: intentModel,
		nerModel:    nerModel,
		httpClient: &http.Client{
			Timeout: 30 * time.Second, // Overall client timeout
		},
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

	// Prepare request
	reqBody := classificationRequest{
		Inputs: text,
		Options: map[string]interface{}{
			"wait_for_model": true,
		},
	}

	var resp classificationResponse
	if err := c.doRequest(ctx, c.intentModel, reqBody, &resp); err != nil {
		return IntentResult{}, fmt.Errorf("failed to classify intent: %w", err)
	}

	if len(resp) == 0 {
		return IntentResult{
			Intent:     IntentUnknown,
			Confidence: 0.0,
		}, nil
	}

	// Get top result
	topResult := resp[0]

	// Map label to Intent
	intent := mapLabelToIntent(topResult.Label)

	log.Debug().
		Str("intent", string(intent)).
		Float64("confidence", topResult.Score).
		Msg("intent classified")

	return IntentResult{
		Intent:     intent,
		Confidence: topResult.Score,
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

	// Prepare request
	reqBody := classificationRequest{
		Inputs: text,
		Options: map[string]interface{}{
			"wait_for_model": true,
		},
	}

	var resp tokenClassificationResponse
	if err := c.doRequest(ctx, c.nerModel, reqBody, &resp); err != nil {
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

// doRequest performs an HTTP request to the HF API.
func (c *HFClient) doRequest(ctx context.Context, model string, reqBody interface{}, respBody interface{}) error {
	// Marshal request body
	jsonData, err := json.Marshal(reqBody)
	if err != nil {
		return fmt.Errorf("failed to marshal request: %w", err)
	}

	// Build URL
	url := fmt.Sprintf("%s/models/%s", c.baseURL, model)

	// Create request
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	// Set headers
	req.Header.Set("Authorization", "Bearer "+c.apiKey)
	req.Header.Set("Content-Type", "application/json")

	// Perform request
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	// Read response body
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("failed to read response: %w", err)
	}

	// Check status code
	if resp.StatusCode != http.StatusOK {
		var errResp hfErrorResponse
		if err := json.Unmarshal(body, &errResp); err == nil && errResp.Error != "" {
			return fmt.Errorf("huggingfaces error: %s", errResp.Error)
		}
		return fmt.Errorf("unexpected status code %d: %s", resp.StatusCode, string(body))
	}

	// Unmarshal response
	if err := json.Unmarshal(body, respBody); err != nil {
		return fmt.Errorf("failed to unmarshal response: %w", err)
	}

	return nil
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
