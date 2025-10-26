# Getting Started

This guide will help you set up and run the Talk to Your Textbook application.

## Prerequisites

1. **Docker & Docker Compose** - Install from [docker.com](https://www.docker.com/)
2. **OpenAI API Key** - Get one from [platform.openai.com](https://platform.openai.com/)
3. **16GB RAM recommended** - For running ML models

## Quick Start (Docker Compose)

### 1. Clone and Configure

```bash
cd talk-to-your-textbook
cp .env.example .env
```

Edit `.env` and add your OpenAI API key:
```bash
OPENAI_API_KEY=sk-your-key-here
```

### 2. Run Setup Script

```bash
make setup
```

This will:
- Build Docker images
- Start all services (Postgres, Redis, MinIO, API, Worker)
- Run database migrations
- Create MinIO bucket

### 3. Access the Application

- **Frontend**: http://localhost:3000
- **API Docs**: http://localhost:8000/docs
- **MinIO Console**: http://localhost:9001 (minioadmin/minioadmin)

### 4. Try it Out

1. Open http://localhost:3000
2. Sign up for an account
3. Upload a PDF textbook
4. Wait for processing (check status in library)
5. Click "Open" to start asking questions!

## Development Mode

For local development with hot reloading:

```bash
# Start backend services only
make dev

# Terminal 1 - Backend API
cd backend
pip install -r requirements.txt
python -m uvicorn main:app --reload

# Terminal 2 - Background Worker
cd worker
python worker.py

# Terminal 3 - Frontend
cd frontend
npm install
npm run dev
```

## Common Commands

```bash
make start      # Start all services
make stop       # Stop all services
make restart    # Restart all services
make logs       # View logs
make migrate    # Run database migrations
make clean      # Remove all data and containers
```

## How It Works

### Upload & Ingest Pipeline

1. **Upload**: Frontend gets presigned URL → uploads PDF directly to MinIO
2. **Worker**: Background job processes PDF:
   - Extracts text with PyMuPDF
   - Chunks paragraphs (~600 tokens, 80 overlap)
   - Generates embeddings with BGE-M3
   - Creates FAISS index
   - Stores metadata in Postgres
3. **Status**: Document status changes: `queued` → `running` → `done`

### Q&A Pipeline

1. **Question**: User asks a question
2. **Retrieval**: Search FAISS for top-8 similar chunks
3. **Generation**: GPT-4o mini generates answer with citations
4. **Streaming**: Answer streams token-by-token via SSE
5. **Citations**: Click `[p. N]` to scroll and highlight in PDF

## Troubleshooting

### Services won't start

```bash
# Check Docker is running
docker info

# Check logs
make logs

# Clean restart
make clean
make setup
```

### "No embeddings model found"

First time running, BGE-M3 model (~900MB) downloads from HuggingFace. This can take 5-10 minutes depending on your connection.

```bash
# Check worker logs
docker compose logs -f worker
```

### PDF won't load in viewer

For MVP, PDFs are accessed directly from MinIO at `localhost:9000`. Make sure:
1. MinIO is running: `docker compose ps minio`
2. Bucket exists: Check http://localhost:9001
3. CORS is configured (should be automatic)

### Upload fails

Check MinIO is accessible:
```bash
curl http://localhost:9000/minio/health/live
```

### Questions return no results

1. Wait for document to finish processing (`status: done`)
2. Check worker logs for errors: `docker compose logs worker`
3. Verify FAISS index was created: Check `/data/faiss` in worker container

## Architecture Overview

```
┌─────────────────┐
│   Next.js       │  Frontend (port 3000)
│   NextAuth      │  - Auth pages
│   PDF.js        │  - PDF viewer
└────────┬────────┘
         │
         ↓ HTTP/SSE
┌─────────────────┐
│   FastAPI       │  Backend API (port 8000)
│   + Auth        │  - REST endpoints
│   + SSE         │  - Streaming answers
└────┬────────────┘
     │
     ├──→ Postgres (port 5432)  - User data, documents, chunks, citations
     ├──→ Redis (port 6379)     - Job queue
     ├──→ MinIO (port 9000)     - PDF storage
     └──→ FAISS                 - Vector search
          
┌─────────────────┐
│   RQ Worker     │  Background worker
│   - PyMuPDF     │  - PDF text extraction
│   - BGE-M3      │  - Embeddings
│   - FAISS       │  - Index creation
└─────────────────┘
```

## Next Steps

After completing the MVP (steps 0-5), you can add:

- **Step 6**: BM25 hybrid retrieval + reranker (better results)
- **Step 7**: Figure extraction (YOLO + pdffigures2)
- **Step 8**: Chart understanding (DePlot)
- **Step 9**: Figure-aware retrieval (CLIP)
- **Step 10**: Citation validation
- **Step 11**: Full CRUD + garbage collection
- **Step 12**: Security hardening (HMAC, rate limits)

See `plan.txt` for the complete roadmap.

## Support

For issues or questions:
1. Check logs: `make logs`
2. Review `plan.txt` for architecture details
3. Check API contract: `API_CONTRACT.md`

## Environment Variables

Key variables in `.env`:

```bash
# Required
OPENAI_API_KEY=sk-...          # Your OpenAI API key

# Optional (defaults shown)
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
MINIO_ENDPOINT=minio:9000
ENABLE_BM25=false              # Enable hybrid retrieval (step 6)
ENABLE_RERANKER=true           # Enable reranking (step 6)
ENABLE_FIGURES=false           # Enable figure extraction (step 7+)
```

Happy learning! 📚

