# clara

WhatsApp assistant for appointment/patient scheduling, reminders, notifications.

## Quick Start

```bash
make dev  # Start MongoDB + run app with hot reload
```

That's it! The command will:
1. Start MongoDB in Docker
2. Wait for it to be ready
3. Run the app with Air hot reload

## Requirements

- Go 1.21+
- Docker & Docker Compose
- Air (hot reload): `go install github.com/cosmtrek/air@latest`

## Development

```bash
make dev    # Start development
make down   # Stop MongoDB
make clean  # Stop + remove MongoDB data
```

## Stack

- Go 1.21+
- whatsmeow (WhatsApp)
- MongoDB (storage)
- Hugging Face Inference API (NLP)
- zerolog (logging)
