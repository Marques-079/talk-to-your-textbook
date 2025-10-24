#!/bin/bash

echo "Starting development environment..."

# Start backend services
docker compose up -d db redis minio

# Wait for services
sleep 3

echo ""
echo "Backend services started. You can now:"
echo ""
echo "Terminal 1 - Backend:"
echo "  cd backend && pip install -r requirements.txt"
echo "  python -m uvicorn main:app --reload"
echo ""
echo "Terminal 2 - Worker:"
echo "  cd worker && python worker.py"
echo ""
echo "Terminal 3 - Frontend:"
echo "  cd frontend && npm install && npm run dev"
echo ""

