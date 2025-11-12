package repository

import (
	"context"

	"github.com/matheusmassa1/clara/internal/domain"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// PatientRepository defines patient data access operations
type PatientRepository interface {
	Create(ctx context.Context, patient *domain.Patient) error
	GetByID(ctx context.Context, id primitive.ObjectID) (*domain.Patient, error)
	GetByPhone(ctx context.Context, phone string) (*domain.Patient, error)
	Update(ctx context.Context, patient *domain.Patient) error
}
