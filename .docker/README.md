# Docker Setup for Clara

Minimal Docker setup with MongoDB and hot reload for local development.

## Quick Start

### Development Mode (with hot reload)

```bash
# Copy env file and configure
cp .env.example .env
# Edit .env with your HF_API_KEY

# Start dev environment
make up-dev

# View logs
make logs

# Scan QR code from terminal output
```

### Production Mode

```bash
# Start prod environment
make up

# View logs
make logs
```

## Architecture

### Services

- **app**: Production container (optimized binary)
- **app-dev**: Development container (hot reload via air)
- **mongodb**: MongoDB 7 (Debian-based)

### Volumes

- `mongo_data`: Persistent MongoDB data (survives `docker-compose down`)
- `whatsapp_session`: WhatsApp session SQLite (persists across restarts)
- `go-build-cache`: Go module cache (dev only, speeds up builds)

### Networks

- `clara-network`: Internal bridge network

## Hot Reload

Uses [air](https://github.com/air-verse/air) to watch Go files and auto-rebuild.

- Watches: `internal/`, `cmd/`, `pkg/`
- Ignores: `whatsapp_session/`, `vendor/`, `*_test.go`
- On change: rebuilds to `/app/bin/clara`, full restart
- WhatsApp session persists (no re-scan needed)

## WhatsApp QR Auth

1. Start dev container: `make up-dev`
2. View logs: `make logs-app`
3. QR code appears in terminal
4. Scan with WhatsApp mobile
5. Session saved to `whatsapp_session` volume
6. Subsequent restarts skip QR if session valid

## MongoDB

- **Host**: `mongodb` (service name)
- **Port**: 27017
- **Database**: `clara` (auto-created)
- **Auth**: None (local dev only)
- **Data**: Persists in `mongo_data` volume

Connect from host:
```bash
make shell-mongo
# In mongosh:
use clara
db.patients.find()
```

## Makefile Commands

```bash
make help           # Show all commands
make up             # Start prod
make up-dev         # Start dev w/ hot reload
make down           # Stop (keeps volumes)
make clean          # Stop + remove volumes
make logs           # Tail all logs
make logs-app       # Tail app logs only
make restart-dev    # Restart dev app
make rebuild-dev    # Rebuild dev image
make shell-dev      # Open shell in dev container
make shell-mongo    # Open MongoDB shell
make test-dev       # Run tests in dev container
```

## Troubleshooting

### MongoDB connection fails

```bash
# Check MongoDB health
docker-compose ps mongodb

# View MongoDB logs
make logs-mongo

# Restart MongoDB
docker-compose restart mongodb
```

### Hot reload not working

```bash
# Check air is running
make shell-dev
ps aux | grep air

# Check .air.toml config
cat /app/.air.toml

# Rebuild dev image
make rebuild-dev
```

### WhatsApp session lost

```bash
# Check volume exists
docker volume ls | grep whatsapp

# Check session files
make shell-dev
ls -la /app/whatsapp_session

# If empty, re-scan QR on next start
```

### Port already in use

If MongoDB port 27017 conflicts:

```yaml
# Edit docker-compose.yml
services:
  mongodb:
    ports:
      - "27018:27017"  # Use 27018 on host

# Update .env
MONGO_URI=mongodb://mongodb:27017  # Keep internal port
```

## Development Workflow

1. Start dev environment: `make up-dev`
2. Scan QR code (first time only)
3. Edit code in `internal/`, `cmd/`
4. air detects changes, rebuilds, restarts
5. Test via WhatsApp messages
6. View logs: `make logs-app`
7. Stop: `make down` (keeps data) or `make clean` (nukes data)

## Production Deployment

For cloud VMs:

```bash
# Build prod image
docker-compose build app

# Run prod container
docker-compose up -d app

# Or use docker directly
docker run -d \
  --name clara \
  -v whatsapp_session:/app/whatsapp_session \
  -e MONGO_URI=mongodb://your-mongo-host:27017 \
  -e HF_API_KEY=your_key \
  --restart unless-stopped \
  clara:latest
```

## Environment Variables

See `.env.example` for full list.

Key vars for Docker:

- `MONGO_URI`: Set to `mongodb://mongodb:27017` in compose (override in prod)
- `SESSION_DIR`: Set to `/app/whatsapp_session` in compose
- `HF_API_KEY`: **Required** for NLP (get from Hugging Face)
- `LOG_LEVEL`: `debug` for dev, `info` for prod

## File Structure

```
.docker/
├── README.md              # This file
├── entrypoint.sh          # Prod entrypoint (MongoDB wait logic)
└── entrypoint-dev.sh      # Dev entrypoint (starts air)

Dockerfile                 # Multi-stage prod build
Dockerfile.dev             # Dev image with air
docker-compose.yml         # Services definition
.dockerignore              # Exclude from context
.air.toml                  # Hot reload config
Makefile                   # Convenience commands
```
