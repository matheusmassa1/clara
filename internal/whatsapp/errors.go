package whatsapp

import (
	"errors"
	"fmt"
	"net"
	"syscall"
)

// Error types for classification.
var (
	// ErrNetwork indicates transient network issues (can retry).
	ErrNetwork = errors.New("network error")

	// ErrProtocol indicates WhatsApp protocol issues (permanent, no retry).
	ErrProtocol = errors.New("protocol error")

	// ErrAuth indicates authentication failure (permanent).
	ErrAuth = errors.New("authentication error")

	// ErrDisconnected indicates client disconnected state.
	ErrDisconnected = errors.New("client disconnected")
)

// isNetworkError checks if error is transient network issue.
// Transient errors should be retried with exponential backoff.
func isNetworkError(err error) bool {
	if err == nil {
		return false
	}

	// Check wrapped errors
	if errors.Is(err, ErrNetwork) {
		return true
	}

	// Network timeout
	var netErr net.Error
	if errors.As(err, &netErr) && netErr.Timeout() {
		return true
	}

	// Connection refused, reset, broken pipe
	var opErr *net.OpError
	if errors.As(err, &opErr) {
		return true
	}

	// Syscall errors (connection issues)
	if errors.Is(err, syscall.ECONNREFUSED) ||
		errors.Is(err, syscall.ECONNRESET) ||
		errors.Is(err, syscall.ECONNABORTED) ||
		errors.Is(err, syscall.EPIPE) {
		return true
	}

	return false
}

// isProtocolError checks if error is permanent protocol issue.
// Protocol errors should not be retried (fail fast).
func isProtocolError(err error) bool {
	if err == nil {
		return false
	}

	// Check wrapped errors
	if errors.Is(err, ErrProtocol) || errors.Is(err, ErrAuth) {
		return true
	}

	// Add WhatsApp-specific protocol error patterns here
	// Examples: invalid session, banned number, API version mismatch
	errStr := err.Error()
	protocolPatterns := []string{
		"401",           // Unauthorized
		"403",           // Forbidden
		"banned",        // Number banned
		"logged out",    // Session invalidated
		"stream error",  // Protocol violation
	}

	for _, pattern := range protocolPatterns {
		if contains(errStr, pattern) {
			return true
		}
	}

	return false
}

// wrapNetworkError wraps error as network error.
func wrapNetworkError(err error, msg string) error {
	return fmt.Errorf("%s: %w: %v", msg, ErrNetwork, err)
}

// wrapProtocolError wraps error as protocol error.
func wrapProtocolError(err error, msg string) error {
	return fmt.Errorf("%s: %w: %v", msg, ErrProtocol, err)
}

// contains checks if string contains substring (case-insensitive helper).
func contains(s, substr string) bool {
	return len(s) >= len(substr) &&
		(s == substr || len(s) > len(substr) &&
		containsHelper(s, substr))
}

func containsHelper(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		match := true
		for j := 0; j < len(substr); j++ {
			if toLower(s[i+j]) != toLower(substr[j]) {
				match = false
				break
			}
		}
		if match {
			return true
		}
	}
	return false
}

func toLower(b byte) byte {
	if b >= 'A' && b <= 'Z' {
		return b + 32
	}
	return b
}
