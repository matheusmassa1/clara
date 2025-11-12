package mongo

import (
	"context"

	"github.com/matheusmassa1/clara/internal/domain"
	"github.com/matheusmassa1/clara/internal/repository"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

// PatientRepo implements repository.PatientRepository for MongoDB
type PatientRepo struct {
	coll *mongo.Collection
}

// NewPatientRepository creates a new MongoDB patient repository
func NewPatientRepository(coll *mongo.Collection) repository.PatientRepository {
	return &PatientRepo{coll: coll}
}

// Create inserts a new patient (stub)
func (r *PatientRepo) Create(ctx context.Context, patient *domain.Patient) error {
	if err := patient.Validate(); err != nil {
		return repository.ErrInvalidInput
	}
	return nil // stub: success
}

// GetByID retrieves patient by ID (stub)
func (r *PatientRepo) GetByID(ctx context.Context, id primitive.ObjectID) (*domain.Patient, error) {
	return nil, repository.ErrNotFound
}

// GetByPhone retrieves patient by phone (stub)
func (r *PatientRepo) GetByPhone(ctx context.Context, phone string) (*domain.Patient, error) {
	return nil, repository.ErrNotFound
}

// Update updates existing patient (stub)
func (r *PatientRepo) Update(ctx context.Context, patient *domain.Patient) error {
	if err := patient.Validate(); err != nil {
		return repository.ErrInvalidInput
	}
	return repository.ErrNotFound
}
