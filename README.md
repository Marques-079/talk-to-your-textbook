# Talk to Your Textbook

A figure-aware, citation-grounded Q&A system for STEM textbooks. Ask questions in natural language and get precise answers with clickable citations.

![Status](https://img.shields.io/badge/status-MVP%20Complete-green)
![Python](https://img.shields.io/badge/python-3.11-blue)
![Next.js](https://img.shields.io/badge/next.js-14-black)

## ✨ What It Does

Upload a PDF textbook → Ask questions → Get cited answers → Click citations to see the source.

```
Q: "What is Young's modulus?"
A: "Young's modulus is a measure of the stiffness of a material [p. 42]. 
    It is defined as the ratio of stress to strain in the elastic region [p. 43]."
    
    [Click p. 42] → PDF viewer scrolls to page 42
```

## 🚀 Quick Start (5 minutes)

```bash
# 1. Setup
cp .env.example .env
# Edit .env: Add your OPENAI_API_KEY=sk-...

# 2. Run
make setup

# 3. Open
open http://localhost:3000
```

**That's it!** Sign up, upload a PDF, and start asking questions.

[→ Detailed Setup Guide](./QUICKSTART.md)

## 📋 What's Built (MVP - Steps 0-5)

- ✅ **Authentication**: NextAuth + JWT
- ✅ **Upload**: Direct-to-MinIO with presigned URLs
- ✅ **Ingestion**: PyMuPDF → BGE-M3 embeddings → FAISS
- ✅ **Q&A**: Vector search → GPT-4o mini → Streaming SSE
- ✅ **Citations**: Click `[p. N]` to navigate PDF viewer
- ✅ **Multi-user**: Per-user document isolation

[→ See What You've Built](./MVP_COMPLETE.md)

## 🗺️ Roadmap (Steps 6-12)

| Step | Feature | Impact |
|------|---------|--------|
| 6 | BM25 + Reranker | Better retrieval quality |
| 7 | Figure Extraction | Extract diagrams/charts |
| 8 | Chart Understanding | Semantic graph parsing (DePlot) |
| 9 | Figure-Aware Retrieval | Answer questions about plots |
| 10 | Citation Validation | Ensure all answers cite sources |
| 11 | CRUD + GC | Full data lifecycle management |
| 12 | Security Hardening | HMAC, rate limits, audit logs |

[→ Full Plan](./plan.txt)

## 🏗️ Architecture

```
┌─────────────┐
│  Next.js    │  Frontend (port 3000)
│  + NextAuth │  • Auth, Library, Chat pages
│  + PDF.js   │  • PDF viewer with citations
└──────┬──────┘
       │ HTTP/SSE
┌──────▼──────┐
│  FastAPI    │  Backend (port 8000)
│  + SQLAlch. │  • REST API + SSE streaming
└──────┬──────┘
       │
       ├─→ PostgreSQL (metadata)
       ├─→ MinIO (PDF storage)
       ├─→ FAISS (vectors)
       └─→ Redis (job queue)
              │
        ┌─────▼─────┐
        │ RQ Worker │  Background jobs
        │ + BGE-M3  │  • Text extraction
        │ + PyMuPDF │  • Embedding generation
        └───────────┘
```

## 💻 Tech Stack

- **Backend**: FastAPI, SQLAlchemy, Alembic, RQ
- **Frontend**: Next.js 14, NextAuth, PDF.js, Tailwind
- **Database**: PostgreSQL 15
- **Storage**: MinIO (S3-compatible)
- **ML**: BGE-M3 (embeddings), GPT-4o mini (generation)
- **Search**: FAISS (HNSW)

## 📚 Documentation

- [QUICKSTART.md](./QUICKSTART.md) - Get running in 5 minutes
- [GETTING_STARTED.md](./GETTING_STARTED.md) - Detailed setup guide
- [MVP_COMPLETE.md](./MVP_COMPLETE.md) - What you've built
- [API_CONTRACT.md](./API_CONTRACT.md) - API reference
- [plan.txt](./plan.txt) - Complete vision (steps 0-12)

## 🛠️ Common Commands

```bash
make setup     # Initial setup (first time)
make start     # Start all services
make stop      # Stop all services
make logs      # View logs
make restart   # Restart services
make clean     # Remove all data
```

## ⚡ Performance

- **RAM**: 3-4 GB (MVP), 6-8 GB (steps 6-9)
- **Ingest**: ~1-2 min per 100 pages
- **Query**: ~2-5 seconds
- **Storage**: ~10 MB per 100 pages (vectors + metadata)

## 🐛 Troubleshooting

```bash
# Check all services
docker compose ps

# View logs
make logs

# Restart everything
make restart

# Clean slate
make clean && make setup
```

## 📝 Example Use Cases

- **Students**: Ask questions while studying
- **Researchers**: Quickly find specific information
- **Educators**: Reference exact pages for citations
- **Self-learners**: Interactive textbook exploration

## 🎯 Current Limitations (MVP)

- No figure/diagram understanding (planned step 7-9)
- Simple chunking (paragraph-based)
- Basic PDF viewer (no text-layer highlighting)
- Dense-only search (hybrid planned step 6)

These are all planned in the roadmap!

## 🔒 Security

- Per-user document isolation
- JWT authentication
- Bcrypt password hashing
- Presigned upload URLs (no PDFs through API)
- SQL injection protection (SQLAlchemy ORM)

(HMAC signing and rate limits coming in step 12)

## 📊 Project Status

**MVP Complete** (Steps 0-5 ✅)

Ready for:
- Personal use
- Testing and feedback
- Feature development (steps 6-12)

Not ready for:
- Public deployment (add step 12 first)
- Production scale (optimize as needed)

## 🤝 Contributing

This is a personal project following the plan in `plan.txt`. Feel free to:
1. Fork and experiment
2. Report issues
3. Suggest improvements

## 📄 License

MIT

---

**Built following the incremental plan in [plan.txt](./plan.txt)**

For questions or issues, check the logs: `make logs`

