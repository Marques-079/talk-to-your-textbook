#!/bin/bash
set -e

echo "Setting up Talk to Your Textbook..."

# Check if .env exists
if [ ! -f .env ]; then
    echo "Creating .env file from example..."
    cp .env.example .env
    echo "⚠️  Please edit .env and add your OPENAI_API_KEY"
    echo ""
fi

# Build and start services
echo "Building and starting services..."
docker compose up -d --build

# Wait for services to be ready
echo "Waiting for services to start..."
sleep 10

# Run migrations
echo "Running database migrations..."
docker compose exec -T api alembic upgrade head

echo ""
echo "✅ Setup complete!"
echo ""
echo "Services running:"
echo "  - Frontend: http://localhost:3000"
echo "  - API: http://localhost:8000"
echo "  - MinIO Console: http://localhost:9001 (minioadmin/minioadmin)"
echo ""
echo "Next steps:"
echo "  1. Make sure you've added your OPENAI_API_KEY to .env"
echo "  2. Restart services: docker compose restart"
echo "  3. Open http://localhost:3000 and sign up"
echo ""

