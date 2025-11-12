# Build stage
FROM golang:1.25-alpine AS builder

WORKDIR /build

# Install build deps (including build tools for CGO/SQLite)
RUN apk add --no-cache git ca-certificates tzdata build-base

# Copy go mod files
COPY go.mod go.sum ./
RUN go mod download

# Copy source
COPY . .

# Build binary (CGO enabled for SQLite)
RUN CGO_ENABLED=1 GOOS=linux go build -ldflags="-w -s" -o clara cmd/clara/main.go

# Runtime stage
FROM alpine:latest

WORKDIR /app

# Install runtime deps (including libs for CGO-built SQLite)
RUN apk add --no-cache ca-certificates tzdata busybox-extras libgcc

# Copy binary from builder
COPY --from=builder /build/clara /app/clara

# Copy entrypoint
COPY .docker/entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

# Create whatsapp session directory
RUN mkdir -p /app/whatsapp_session

# Expose port (for future use)
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD pgrep -x clara || exit 1

ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["/app/clara"]
