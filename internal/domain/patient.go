package domain

import (
	"errors"
	"regexp"
	"strings"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// Patient represents a patient entity
type Patient struct {
	ID    primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	Name  string             `bson:"name" json:"name"`
	Phone string             `bson:"phone" json:"phone"` // WhatsApp number
}

var phoneRegex = regexp.MustCompile(`^\+?[1-9]\d{1,14}$`)

// Validate checks Patient fields
func (p *Patient) Validate() error {
	if strings.TrimSpace(p.Name) == "" {
		return errors.New("name cannot be empty")
	}

	if strings.TrimSpace(p.Phone) == "" {
		return errors.New("phone cannot be empty")
	}

	// Basic E.164 phone validation (international format)
	phone := strings.ReplaceAll(p.Phone, " ", "")
	phone = strings.ReplaceAll(phone, "-", "")
	phone = strings.ReplaceAll(phone, "(", "")
	phone = strings.ReplaceAll(phone, ")", "")

	if !phoneRegex.MatchString(phone) {
		return errors.New("invalid phone format")
	}

	return nil
}
