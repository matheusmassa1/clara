package mongo

import (
	"context"
	"errors"
	"fmt"

	"github.com/matheusmassa1/clara/internal/domain"
	"github.com/matheusmassa1/clara/internal/repository"
	"github.com/rs/zerolog/log"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

// PatientRepo implements repository.PatientRepository for MongoDB
type PatientRepo struct {
	coll *mongo.Collection
}

// NewPatientRepository creates a new MongoDB patient repository
func NewPatientRepository(db *mongo.Database) repository.PatientRepository {
	return &PatientRepo{coll: db.Collection("patients")}
}

// Create inserts a new patient
func (r *PatientRepo) Create(ctx context.Context, patient *domain.Patient) error {
	if err := patient.Validate(); err != nil {
		return repository.ErrInvalidInput
	}

	result, err := r.coll.InsertOne(ctx, patient)
	if err != nil {
		// Check for duplicate key error (unique phone index)
		if mongo.IsDuplicateKeyError(err) {
			return repository.ErrDuplicate
		}
		return fmt.Errorf("failed to create patient: %w", err)
	}

	patient.ID = result.InsertedID.(primitive.ObjectID)
	log.Info().Str("patient_id", patient.ID.Hex()).Msg("patient created successfully")
	return nil
}

// GetByID retrieves patient by ID
func (r *PatientRepo) GetByID(ctx context.Context, id primitive.ObjectID) (*domain.Patient, error) {
	var patient domain.Patient
	err := r.coll.FindOne(ctx, bson.M{"_id": id}).Decode(&patient)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, repository.ErrNotFound
		}
		return nil, fmt.Errorf("failed to get patient by id: %w", err)
	}
	return &patient, nil
}

// GetByPhone retrieves patient by phone
func (r *PatientRepo) GetByPhone(ctx context.Context, phone string) (*domain.Patient, error) {
	var patient domain.Patient
	err := r.coll.FindOne(ctx, bson.M{"phone": phone}).Decode(&patient)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, repository.ErrNotFound
		}
		return nil, fmt.Errorf("failed to get patient by phone: %w", err)
	}
	return &patient, nil
}

// Update updates existing patient
func (r *PatientRepo) Update(ctx context.Context, patient *domain.Patient) error {
	if err := patient.Validate(); err != nil {
		return repository.ErrInvalidInput
	}

	filter := bson.M{"_id": patient.ID}
	update := bson.M{"$set": bson.M{
		"name":  patient.Name,
		"phone": patient.Phone,
	}}

	result, err := r.coll.UpdateOne(ctx, filter, update)
	if err != nil {
		// Check for duplicate key error (unique phone index)
		if mongo.IsDuplicateKeyError(err) {
			return repository.ErrDuplicate
		}
		return fmt.Errorf("failed to update patient: %w", err)
	}

	if result.MatchedCount == 0 {
		return repository.ErrNotFound
	}

	log.Info().Str("patient_id", patient.ID.Hex()).Msg("patient updated successfully")
	return nil
}
