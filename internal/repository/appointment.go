package repository

import (
	"context"
	"time"

	"github.com/matheusmassa1/clara/internal/domain"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// AppointmentRepository defines appointment data access operations
type AppointmentRepository interface {
	Create(ctx context.Context, apt *domain.Appointment) error
	GetByID(ctx context.Context, id primitive.ObjectID) (*domain.Appointment, error)
	List(ctx context.Context) ([]*domain.Appointment, error)
	Update(ctx context.Context, apt *domain.Appointment) error
	Delete(ctx context.Context, id primitive.ObjectID) error
	ListByPatient(ctx context.Context, patientID primitive.ObjectID) ([]*domain.Appointment, error)
	ListByDateRange(ctx context.Context, start, end time.Time) ([]*domain.Appointment, error)
	ListByStatus(ctx context.Context, status string) ([]*domain.Appointment, error)
}
