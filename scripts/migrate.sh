#!/bin/bash
set -e

echo "Running database migrations..."

# Wait for database to be ready
echo "Waiting for database..."
sleep 5

# Run migrations
docker compose exec api alembic upgrade head

echo "Migrations complete!"

