from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os

from app.api import auth, documents, chats, ask
from app.core.config import settings

app = FastAPI(title="Textbook Q&A API", version="1.0.0")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API routes
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(documents.router, prefix="/api", tags=["documents"])
app.include_router(chats.router, prefix="/api/chats", tags=["chats"])
app.include_router(ask.router, prefix="/api", tags=["ask"])

@app.get("/api/healthz")
async def healthcheck():
    return {"status": "ok", "version": "1.0.0"}

# Serve Next.js static files (production)
if os.path.exists("/app/frontend/out"):
    app.mount("/", StaticFiles(directory="/app/frontend/out", html=True), name="static")

