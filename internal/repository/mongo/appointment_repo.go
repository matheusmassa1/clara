package mongo

import (
	"context"
	"time"

	"github.com/matheusmassa1/clara/internal/domain"
	"github.com/matheusmassa1/clara/internal/repository"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

// AppointmentRepo implements repository.AppointmentRepository for MongoDB
type AppointmentRepo struct {
	coll *mongo.Collection
}

// NewAppointmentRepository creates a new MongoDB appointment repository
func NewAppointmentRepository(coll *mongo.Collection) repository.AppointmentRepository {
	return &AppointmentRepo{coll: coll}
}

// Create inserts a new appointment (stub)
func (r *AppointmentRepo) Create(ctx context.Context, apt *domain.Appointment) error {
	if err := apt.Validate(); err != nil {
		return repository.ErrInvalidInput
	}
	return nil // stub: success
}

// GetByID retrieves appointment by ID (stub)
func (r *AppointmentRepo) GetByID(ctx context.Context, id primitive.ObjectID) (*domain.Appointment, error) {
	return nil, repository.ErrNotFound
}

// List retrieves all appointments (stub)
func (r *AppointmentRepo) List(ctx context.Context) ([]*domain.Appointment, error) {
	return []*domain.Appointment{}, nil
}

// Update updates existing appointment (stub)
func (r *AppointmentRepo) Update(ctx context.Context, apt *domain.Appointment) error {
	if err := apt.Validate(); err != nil {
		return repository.ErrInvalidInput
	}
	return repository.ErrNotFound
}

// Delete removes appointment by ID (stub)
func (r *AppointmentRepo) Delete(ctx context.Context, id primitive.ObjectID) error {
	return repository.ErrNotFound
}

// ListByPatient retrieves appointments for patient (stub)
func (r *AppointmentRepo) ListByPatient(ctx context.Context, patientID primitive.ObjectID) ([]*domain.Appointment, error) {
	return []*domain.Appointment{}, nil
}

// ListByDateRange retrieves appointments in date range (stub)
func (r *AppointmentRepo) ListByDateRange(ctx context.Context, start, end time.Time) ([]*domain.Appointment, error) {
	return []*domain.Appointment{}, nil
}

// ListByStatus retrieves appointments by status (stub)
func (r *AppointmentRepo) ListByStatus(ctx context.Context, status string) ([]*domain.Appointment, error) {
	return []*domain.Appointment{}, nil
}
