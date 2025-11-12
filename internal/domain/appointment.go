package domain

import (
	"errors"
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// Appointment status constants
const (
	StatusPending   = "pending"
	StatusConfirmed = "confirmed"
	StatusCancelled = "cancelled"
)

// Appointment represents an appointment entity
type Appointment struct {
	ID       primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	DateTime time.Time          `bson:"datetime" json:"datetime"`
	Patient  primitive.ObjectID `bson:"patient" json:"patient"` // Patient reference
	Status   string             `bson:"status" json:"status"`
}

// Validate checks Appointment fields
func (a *Appointment) Validate() error {
	if a.Status != StatusPending && a.Status != StatusConfirmed && a.Status != StatusCancelled {
		return errors.New("invalid status: must be pending, confirmed, or cancelled")
	}

	if a.Patient.IsZero() {
		return errors.New("patient ID cannot be zero")
	}

	if a.DateTime.IsZero() {
		return errors.New("datetime cannot be zero")
	}

	return nil
}
