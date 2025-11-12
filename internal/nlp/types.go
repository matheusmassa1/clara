package nlp

// Intent represents a classified user intent.
type Intent string

const (
	IntentScheduleAppointment   Intent = "schedule_appointment"
	IntentCancelAppointment     Intent = "cancel_appointment"
	IntentRescheduleAppointment Intent = "reschedule_appointment"
	IntentCheckAvailability     Intent = "check_availability"
	IntentUnknown               Intent = "unknown"
)

// EntityType represents the type of extracted entity.
type EntityType string

const (
	EntityDateTime    EntityType = "datetime"
	EntityPatientName EntityType = "patient_name"
	EntityPhone       EntityType = "phone"
	EntityServiceType EntityType = "service_type"
)

// IntentResult contains the classified intent and its confidence score.
type IntentResult struct {
	Intent     Intent  `json:"intent"`
	Confidence float64 `json:"confidence"`
}

// Entity represents an extracted entity from user input.
type Entity struct {
	Type       EntityType `json:"type"`
	Value      string     `json:"value"`
	Confidence float64    `json:"confidence"`
}

// NLPResult contains the complete NLP processing result.
type NLPResult struct {
	Intent        IntentResult `json:"intent"`
	Entities      []Entity     `json:"entities"`
	LowConfidence bool         `json:"low_confidence"` // true if confidence < threshold
}
