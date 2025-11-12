package nlp

import "errors"

var (
	// ErrLowConfidence indicates intent/entity confidence is below threshold.
	ErrLowConfidence = errors.New("confidence below threshold")

	// ErrAPIFailure indicates Hugging Face API request failed.
	ErrAPIFailure = errors.New("hugging face api failure")

	// ErrInvalidInput indicates input text is invalid (empty, malformed).
	ErrInvalidInput = errors.New("invalid input text")

	// ErrTextTooLong indicates input text exceeds maximum allowed length.
	ErrTextTooLong = errors.New("text exceeds 400 character limit")
)
