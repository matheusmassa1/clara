# clara

WhatsApp assistant for appointment/patient scheduling, reminders, notifications.

## Stack

- Go 1.21+
- whatsmeow (WhatsApp)
- MongoDB (storage)
- Hugging Face Inference API (NLP)
- zerolog (logging)
- testify (testing)
- Docker + cloud deployment

## Structure

```
cmd/clara/          # main entry
internal/
  domain/           # models (Appointment, Patient)
  handler/          # WhatsApp message handlers
  nlp/              # NLP service (intent + entity extraction)
  service/          # business logic
  repository/       # MongoDB data access
  session/          # in-memory conversation context
pkg/                # reusable packages if needed
```

## Conventions

- English code/comments
- lowercase package names, TitleCase exports
- conventional commits
- branches: `matheusmassa/feature-name`
- MongoDB: plural collection names (appointments, patients)
- error handling: wrap with context, return early
- DI via constructors

## Domain Models

**Appointment** (appointments collection):
```go
type Appointment struct {
    ID       primitive.ObjectID `bson:"_id,omitempty" json:"id"`
    DateTime time.Time          `bson:"datetime" json:"datetime"`
    Patient  primitive.ObjectID `bson:"patient" json:"patient"`
    Status   string              `bson:"status" json:"status"` // pending, confirmed, cancelled
}
```

**Patient** (patients collection):
```go
type Patient struct {
    ID    primitive.ObjectID `bson:"_id,omitempty" json:"id"`
    Name  string              `bson:"name" json:"name"`
    Phone string              `bson:"phone" json:"phone"` // WhatsApp number
}
```

## Architecture

Layered: handler → nlp → service → repository

- Handlers: WhatsApp message processing
- NLP: Intent classification + entity extraction (HF API)
- Services: business logic, appointment scheduling
- Repositories: MongoDB CRUD with interfaces
- Session: In-memory conversation context tracking
- Interface-based design for mocks/testing

## WhatsApp

- QR code auth on terminal via whatsmeow
- Single bot instance
- PT-BR conversations (natural, human-like)
- Message handlers for commands

## NLP

**Language:** PT-BR (Brazilian Portuguese)

**Models:**
- Intent: `neuralmind/bert-base-portuguese-cased` (via HF Inference API)
- NER: `pierreguillou/ner-bert-base-cased-pt-lenerbr` (via HF Inference API)

**Intents:**
- `schedule_appointment` - user wants to book
- `cancel_appointment` - user wants to cancel
- `reschedule_appointment` - user wants to change time
- `check_availability` - user asks for available slots

**Entities:**
- `datetime` - appointment date/time
- `patient_name` - patient name
- `phone` - contact number
- `service_type` - type of service/appointment

**Confidence:**
- Threshold: 0.7 (70%)
- Below threshold → ask clarification
- Confirmation step before final actions

**Session Management:**
- In-memory conversation context (migrate to Redis later)
- Track multi-turn dialogs
- Store partial entities across messages
- Timeout: 15min inactivity

**Conversation Flow:**
1. Receive message → extract intent + entities
2. If low confidence → clarify
3. If missing entities → ask follow-up
4. Confirm action before execution
5. Execute + respond naturally

## Testing

- testify framework
- table-driven tests
- unit tests per package
- integration tests for flows
- mock external deps (MongoDB, WhatsApp, HF API)
- NLP edge cases: ambiguous input, missing entities, low confidence, PT-BR variations

## Dependencies

Core:
- `github.com/tulir/whatsmeow`
- `go.mongodb.org/mongo-driver`
- `github.com/rs/zerolog`

NLP:
- Hugging Face Inference API client
- `github.com/olebedev/when` (PT-BR datetime parsing)

Testing:
- `github.com/stretchr/testify`

Config:
- `github.com/joho/godotenv`

## Deployment

- Docker multi-stage build (alpine base)
- Cloud platform ready
- Env vars for config (MongoDB URI, WhatsApp session, HF API, etc.)

## Config
- Config via env/flags; validate on startup; fail fast.
- Treat config as imutable after init; pass explicitily (not via globals).
- Provide sane defaults and clear docs.
Use godotenv + structured config:
```go
type Config struct {
    MongoURI       string
    DBName         string
    LogLevel       string
    HFAPIKey       string
    HFIntentModel  string
    HFNERModel     string
}
```

## Logging

zerolog throughout. Structured logging:
```go
log.Info().Str("patient", id).Msg("appointment created")
```

## Before Coding
- **MUST** Ask clarifying questions for ambiguous requirements.
- **MUST** Draft and confirm an approach (API shape, data flow, failure modes) before writing code.
- **SHOULD** When >2 approaches exist, list pros/cons and rationale.
- **SHOULD** Define testing strategy (unit/integration) and observability signals up front.

## 3 — Code Style
- **MUST** Enforce `gofmt`, `go vet`
- **MUST** Avoid stutter in names: `package kv; type Store` (not `KVStore` in `kv`).
- **SHOULD** Small interfaces near consumers; prefer composition over inheritance.
- **SHOULD** Avoid reflection on hot paths; prefer generics when it clarifies and speeds.
- **MUST** Use input structs for function receiving more than 2 arguments. Input contexts should not get in the input struct.
- **SHOULD** Declare function input structs before the function consuming them.

## Writing Functions Best Practices
1. Can you read the function and HONESTLY easily follow what it's doing? If yes, then stop here.
2. Does the function have very high cyclomatic complexity? (number of independent paths, or, in a lot of cases, number of nesting if if-else as a proxy). If it does, then it's probably sketchy.
3. Are there any common data structures and algorithms that would make this function much easier to follow and more robust? Parsers, trees, stacks / queues, etc.
4. Does it have any hidden untested dependencies or any values that can be factored out into the arguments instead? Only care about non-trivial dependencies that can actually change or affect the function.
5. Brainstorm 3 better function names and see if the current name is the best, consistent with rest of codebase.