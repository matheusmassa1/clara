package handler

import (
	"go.mau.fi/whatsmeow/types/events"
)

// MessageHandler defines interface for WhatsApp message handling.
// Future phases will implement routing logic (NLP, appointment scheduling).
type MessageHandler interface {
	// Handle processes incoming WhatsApp message.
	Handle(msg *events.Message) error
}

// EchoHandler implements simple echo functionality for testing.
type EchoHandler struct{}

// NewEchoHandler creates echo handler instance.
func NewEchoHandler() *EchoHandler {
	return &EchoHandler{}
}

// Handle echoes message back (implementation in whatsapp package).
// This is a placeholder interface for future multi-handler routing.
func (h *EchoHandler) Handle(msg *events.Message) error {
	// Echo logic is currently in whatsapp/message.go
	// In future phases, this will route to NLP → service → repo
	return nil
}
