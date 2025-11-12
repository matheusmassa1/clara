package nlp

import (
	"context"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestService_Process_InputValidation(t *testing.T) {
	// Create a service with nil client - we're only testing input validation
	svc := &service{
		confidenceThresh: ConfidenceThreshold,
	}
	ctx := context.Background()

	t.Run("empty input", func(t *testing.T) {
		_, err := svc.Process(ctx, "")
		assert.ErrorIs(t, err, ErrInvalidInput)
	})

	t.Run("whitespace only input", func(t *testing.T) {
		_, err := svc.Process(ctx, "   \t\n  ")
		assert.ErrorIs(t, err, ErrInvalidInput)
	})

	t.Run("text too long", func(t *testing.T) {
		longText := strings.Repeat("a", MaxTextLength+1)
		_, err := svc.Process(ctx, longText)
		assert.ErrorIs(t, err, ErrTextTooLong)
	})
}

func TestMapLabelToIntent(t *testing.T) {
	tests := []struct {
		label string
		want  Intent
	}{
		{"schedule", IntentScheduleAppointment},
		{"agendar", IntentScheduleAppointment},
		{"marcar", IntentScheduleAppointment},
		{"cancel", IntentCancelAppointment},
		{"cancelar", IntentCancelAppointment},
		{"reschedule", IntentRescheduleAppointment},
		{"remarcar", IntentRescheduleAppointment},
		{"check", IntentCheckAvailability},
		{"verificar", IntentCheckAvailability},
		{"unknown_label", IntentUnknown},
		{"", IntentUnknown},
	}

	for _, tt := range tests {
		t.Run(tt.label, func(t *testing.T) {
			got := mapLabelToIntent(tt.label)
			assert.Equal(t, tt.want, got)
		})
	}
}

func TestMapLabelToEntityType(t *testing.T) {
	tests := []struct {
		label string
		want  EntityType
	}{
		{"PER", EntityPatientName},
		{"PESSOA", EntityPatientName},
		{"person", EntityPatientName},
		{"TIME", EntityDateTime},
		{"DATA", EntityDateTime},
		{"date", EntityDateTime},
		{"PHONE", EntityPhone},
		{"TEL", EntityPhone},
		{"ORG", EntityServiceType},
		{"unknown", ""},
		{"", ""},
	}

	for _, tt := range tests {
		t.Run(tt.label, func(t *testing.T) {
			got := mapLabelToEntityType(tt.label)
			assert.Equal(t, tt.want, got)
		})
	}
}
