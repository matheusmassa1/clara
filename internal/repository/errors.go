package repository

import "errors"

var (
	// ErrNotFound is returned when entity not found in repo
	ErrNotFound = errors.New("entity not found")

	// ErrDuplicate is returned when entity already exists
	ErrDuplicate = errors.New("entity already exists")

	// ErrInvalidInput is returned when input validation fails
	ErrInvalidInput = errors.New("invalid input")
)
