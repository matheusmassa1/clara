#!/bin/sh
set -e

echo "==> Waiting for MongoDB to be ready..."

# Wait for MongoDB
MAX_RETRIES=30
RETRY_COUNT=0
RETRY_INTERVAL=2

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
  if nc -z mongodb 27017 > /dev/null 2>&1; then
    echo "==> MongoDB is ready!"
    break
  fi

  RETRY_COUNT=$((RETRY_COUNT + 1))
  echo "==> MongoDB not ready yet (attempt $RETRY_COUNT/$MAX_RETRIES), retrying in ${RETRY_INTERVAL}s..."
  sleep $RETRY_INTERVAL
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
  echo "==> ERROR: MongoDB did not become ready in time"
  exit 1
fi

# Ensure whatsapp session directory exists
mkdir -p /app/whatsapp_session

echo "==> Starting Clara..."
exec "$@"
