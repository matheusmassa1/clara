package mongo

import (
	"context"
	"fmt"
	"time"

	"github.com/rs/zerolog/log"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// Connect establishes connection to MongoDB with timeout and ping verification.
func Connect(ctx context.Context, uri, dbName string) (*mongo.Client, *mongo.Database, error) {
	log.Info().Str("uri", uri).Str("db", dbName).Msg("connecting to mongodb")

	// 10s timeout for connection
	connCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	clientOpts := options.Client().ApplyURI(uri)
	client, err := mongo.Connect(connCtx, clientOpts)
	if err != nil {
		log.Error().Err(err).Msg("failed to connect to mongodb")
		return nil, nil, fmt.Errorf("failed to connect to mongodb: %w", err)
	}

	// Ping to verify connection
	pingCtx, pingCancel := context.WithTimeout(ctx, 10*time.Second)
	defer pingCancel()

	if err := client.Ping(pingCtx, nil); err != nil {
		log.Error().Err(err).Msg("failed to ping mongodb")
		return nil, nil, fmt.Errorf("failed to ping mongodb: %w", err)
	}

	db := client.Database(dbName)
	log.Info().Str("db", dbName).Msg("mongodb connected successfully")

	return client, db, nil
}

// Disconnect gracefully closes MongoDB connection.
func Disconnect(ctx context.Context, client *mongo.Client) error {
	if client == nil {
		return nil
	}

	log.Info().Msg("disconnecting from mongodb")

	disconnectCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	if err := client.Disconnect(disconnectCtx); err != nil {
		log.Error().Err(err).Msg("failed to disconnect from mongodb")
		return fmt.Errorf("failed to disconnect from mongodb: %w", err)
	}

	log.Info().Msg("mongodb disconnected successfully")
	return nil
}

// EnsureIndexes creates required indexes on collections.
func EnsureIndexes(ctx context.Context, db *mongo.Database) error {
	log.Info().Msg("ensuring mongodb indexes")

	// Patients: unique index on phone
	patientsCol := db.Collection("patients")
	phoneIdx := mongo.IndexModel{
		Keys:    bson.D{{Key: "phone", Value: 1}},
		Options: options.Index().SetUnique(true),
	}
	phoneIdxName, err := patientsCol.Indexes().CreateOne(ctx, phoneIdx)
	if err != nil {
		return fmt.Errorf("failed to create phone index: %w", err)
	}
	log.Info().Str("index", phoneIdxName).Msg("created patients.phone index")

	// Appointments: index on patient
	appointmentsCol := db.Collection("appointments")
	patientIdx := mongo.IndexModel{
		Keys: bson.D{{Key: "patient", Value: 1}},
	}
	patientIdxName, err := appointmentsCol.Indexes().CreateOne(ctx, patientIdx)
	if err != nil {
		return fmt.Errorf("failed to create patient index: %w", err)
	}
	log.Info().Str("index", patientIdxName).Msg("created appointments.patient index")

	// Appointments: index on datetime
	datetimeIdx := mongo.IndexModel{
		Keys: bson.D{{Key: "datetime", Value: 1}},
	}
	datetimeIdxName, err := appointmentsCol.Indexes().CreateOne(ctx, datetimeIdx)
	if err != nil {
		return fmt.Errorf("failed to create datetime index: %w", err)
	}
	log.Info().Str("index", datetimeIdxName).Msg("created appointments.datetime index")

	// Appointments: index on status
	statusIdx := mongo.IndexModel{
		Keys: bson.D{{Key: "status", Value: 1}},
	}
	statusIdxName, err := appointmentsCol.Indexes().CreateOne(ctx, statusIdx)
	if err != nil {
		return fmt.Errorf("failed to create status index: %w", err)
	}
	log.Info().Str("index", statusIdxName).Msg("created appointments.status index")

	log.Info().Msg("all indexes created successfully")
	return nil
}
