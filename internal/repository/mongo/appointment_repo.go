package mongo

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/matheusmassa1/clara/internal/domain"
	"github.com/matheusmassa1/clara/internal/repository"
	"github.com/rs/zerolog/log"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

// AppointmentRepo implements repository.AppointmentRepository for MongoDB
type AppointmentRepo struct {
	coll *mongo.Collection
}

// NewAppointmentRepository creates a new MongoDB appointment repository
func NewAppointmentRepository(db *mongo.Database) repository.AppointmentRepository {
	return &AppointmentRepo{coll: db.Collection("appointments")}
}

// Create inserts a new appointment
func (r *AppointmentRepo) Create(ctx context.Context, apt *domain.Appointment) error {
	if err := apt.Validate(); err != nil {
		return repository.ErrInvalidInput
	}

	result, err := r.coll.InsertOne(ctx, apt)
	if err != nil {
		return fmt.Errorf("failed to create appointment: %w", err)
	}

	apt.ID = result.InsertedID.(primitive.ObjectID)
	log.Info().Str("appointment_id", apt.ID.Hex()).Msg("appointment created successfully")
	return nil
}

// GetByID retrieves appointment by ID
func (r *AppointmentRepo) GetByID(ctx context.Context, id primitive.ObjectID) (*domain.Appointment, error) {
	var apt domain.Appointment
	err := r.coll.FindOne(ctx, bson.M{"_id": id}).Decode(&apt)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, repository.ErrNotFound
		}
		return nil, fmt.Errorf("failed to get appointment by id: %w", err)
	}
	return &apt, nil
}

// List retrieves all appointments
func (r *AppointmentRepo) List(ctx context.Context) ([]*domain.Appointment, error) {
	cursor, err := r.coll.Find(ctx, bson.M{})
	if err != nil {
		return nil, fmt.Errorf("failed to list appointments: %w", err)
	}
	defer cursor.Close(ctx)

	var appointments []*domain.Appointment
	if err := cursor.All(ctx, &appointments); err != nil {
		return nil, fmt.Errorf("failed to decode appointments: %w", err)
	}

	return appointments, nil
}

// Update updates existing appointment
func (r *AppointmentRepo) Update(ctx context.Context, apt *domain.Appointment) error {
	if err := apt.Validate(); err != nil {
		return repository.ErrInvalidInput
	}

	filter := bson.M{"_id": apt.ID}
	update := bson.M{"$set": bson.M{
		"datetime": apt.DateTime,
		"patient":  apt.Patient,
		"status":   apt.Status,
	}}

	result, err := r.coll.UpdateOne(ctx, filter, update)
	if err != nil {
		return fmt.Errorf("failed to update appointment: %w", err)
	}

	if result.MatchedCount == 0 {
		return repository.ErrNotFound
	}

	log.Info().Str("appointment_id", apt.ID.Hex()).Msg("appointment updated successfully")
	return nil
}

// Delete removes appointment by ID
func (r *AppointmentRepo) Delete(ctx context.Context, id primitive.ObjectID) error {
	result, err := r.coll.DeleteOne(ctx, bson.M{"_id": id})
	if err != nil {
		return fmt.Errorf("failed to delete appointment: %w", err)
	}

	if result.DeletedCount == 0 {
		return repository.ErrNotFound
	}

	log.Info().Str("appointment_id", id.Hex()).Msg("appointment deleted successfully")
	return nil
}

// ListByPatient retrieves appointments for patient
func (r *AppointmentRepo) ListByPatient(ctx context.Context, patientID primitive.ObjectID) ([]*domain.Appointment, error) {
	cursor, err := r.coll.Find(ctx, bson.M{"patient": patientID})
	if err != nil {
		return nil, fmt.Errorf("failed to list appointments by patient: %w", err)
	}
	defer cursor.Close(ctx)

	var appointments []*domain.Appointment
	if err := cursor.All(ctx, &appointments); err != nil {
		return nil, fmt.Errorf("failed to decode appointments by patient: %w", err)
	}

	return appointments, nil
}

// ListByDateRange retrieves appointments in date range
func (r *AppointmentRepo) ListByDateRange(ctx context.Context, start, end time.Time) ([]*domain.Appointment, error) {
	filter := bson.M{
		"datetime": bson.M{
			"$gte": start,
			"$lte": end,
		},
	}

	cursor, err := r.coll.Find(ctx, filter)
	if err != nil {
		return nil, fmt.Errorf("failed to list appointments by date range: %w", err)
	}
	defer cursor.Close(ctx)

	var appointments []*domain.Appointment
	if err := cursor.All(ctx, &appointments); err != nil {
		return nil, fmt.Errorf("failed to decode appointments by date range: %w", err)
	}

	return appointments, nil
}

// ListByStatus retrieves appointments by status
func (r *AppointmentRepo) ListByStatus(ctx context.Context, status string) ([]*domain.Appointment, error) {
	cursor, err := r.coll.Find(ctx, bson.M{"status": status})
	if err != nil {
		return nil, fmt.Errorf("failed to list appointments by status: %w", err)
	}
	defer cursor.Close(ctx)

	var appointments []*domain.Appointment
	if err := cursor.All(ctx, &appointments); err != nil {
		return nil, fmt.Errorf("failed to decode appointments by status: %w", err)
	}

	return appointments, nil
}
