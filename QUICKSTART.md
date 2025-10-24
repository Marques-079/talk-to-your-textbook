# Quick Start Guide

Get up and running in 5 minutes!

## Prerequisites

- Docker Desktop installed and running
- OpenAI API key

## Setup (First Time)

```bash
# 1. Get OpenAI API key from https://platform.openai.com/

# 2. Create .env file
cp .env.example .env

# 3. Edit .env and add your key
# Change this line:
#   OPENAI_API_KEY=
# To:
#   OPENAI_API_KEY=sk-your-actual-key-here

# 4. Run setup
make setup

# This will:
# - Build Docker images (~5 min first time)
# - Start all services
# - Run database migrations
# - Download BGE-M3 model (~900MB, first run only)
```

## Usage

```bash
# 1. Open browser
open http://localhost:3000

# 2. Sign up with email/password

# 3. Upload a PDF textbook

# 4. Wait for processing (status changes to "Ready")

# 5. Click "Open" to start asking questions!
```

## Example Questions to Try

For a physics textbook:
- "What is Young's modulus?"
- "Define elastic limit"
- "Explain the stress-strain curve"

For a biology textbook:
- "What is photosynthesis?"
- "Describe the cell membrane structure"
- "How does DNA replication work?"

## Daily Usage

```bash
# Start (if stopped)
make start

# Stop (when done)
make stop

# View logs (if something breaks)
make logs
```

## Troubleshooting

### "Connection refused" errors
Docker might not be running. Start Docker Desktop.

### Upload doesn't work
```bash
# Restart services
make restart

# Check MinIO is healthy
curl http://localhost:9000/minio/health/live
```

### Worker isn't processing
```bash
# Check worker logs
docker compose logs worker

# First run downloads BGE-M3 model (wait 5-10 min)
```

### Out of memory
Close other applications. Minimum 8GB RAM, 16GB recommended.

## What's Happening Behind the Scenes?

1. **Upload**: PDF goes to MinIO storage
2. **Worker**: Extracts text, creates chunks, generates embeddings
3. **FAISS**: Stores vector embeddings for fast search
4. **Ask**: Question → search vectors → GPT-4o mini → cited answer
5. **Citations**: Click to scroll PDF viewer to exact page

## Next Steps

- Read `MVP_COMPLETE.md` for what you've built
- Read `GETTING_STARTED.md` for detailed documentation
- Read `plan.txt` to see the full vision (steps 6-12)

## Support

Something not working?

```bash
# Check all services are running
docker compose ps

# View logs for specific service
docker compose logs api
docker compose logs worker
docker compose logs db

# Nuclear option (clean slate)
make clean
make setup
```

## Limits (MVP)

- **No figure/diagram understanding yet** (steps 7-9)
- **No BM25 hybrid search yet** (step 6)
- **Simple chunking** (paragraph-based, not heading-aware)
- **PDF viewer basic** (no text highlighting yet, only page scroll)

These are all planned enhancements in your roadmap!

Enjoy your textbook Q&A system! 📚

