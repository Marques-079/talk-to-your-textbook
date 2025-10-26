# DISCLAIMER : This code was gen HEAVILY with Cursor 
# Talk to Your Textbook

A figure-aware, citation-grounded Q&A system for STEM textbooks. Ask questions in natural language and get precise answers with clickable citations.

![Status](https://img.shields.io/badge/status-MVP%20Complete-green)
![Python](https://img.shields.io/badge/python-3.11-blue)
![Next.js](https://img.shields.io/badge/next.js-14-black)
---

## ✨ What It Does

Upload a PDF textbook → Ask questions → Get cited answers → Click citations to see the source.

```
Q: "What is Young's modulus?"
A: "Young's modulus is a measure of the stiffness of a material [p. 42]. 
    It is defined as the ratio of stress to strain in the elastic region [p. 43]."
    
    [Click p. 42] → PDF viewer scrolls to page 42
```
---

## ✨ UI Preview

A quick look at the core screens — minimal, readable, and ready for dark or light modes.

<table>
  <tr>
    <td width="50%">
      <strong>Dark mode — Chat Interaction</strong><br/>
      <a href="https://github.com/Marques-079/talk-to-your-textbook/blob/ff4062cee6ffbcd0016407684a7845f1e79559ce/cursors/s1.2025.png">
        <img alt="Dark mode chat interaction" src="https://github.com/Marques-079/talk-to-your-textbook/blob/ff4062cee6ffbcd0016407684a7845f1e79559ce/cursors/s1.2025.png?raw=1" width="100%"/>
      </a>
    </td>
    <td width="50%">
      <strong>Create Account</strong><br/>
      <a href="https://github.com/Marques-079/talk-to-your-textbook/blob/ff4062cee6ffbcd0016407684a7845f1e79559ce/cursors/s2.2025.png">
        <img alt="Create account screen" src="https://github.com/Marques-079/talk-to-your-textbook/blob/ff4062cee6ffbcd0016407684a7845f1e79559ce/cursors/s2.2025.png?raw=1" width="100%"/>
      </a>
    </td>
  </tr>
  <tr>
    <td width="50%">
      <strong>Light mode — Chat Interaction</strong><br/>
      <a href="https://github.com/Marques-079/talk-to-your-textbook/blob/ff4062cee6ffbcd0016407684a7845f1e79559ce/cursors/s3.2025.png">
        <img alt="Light mode chat interaction" src="https://github.com/Marques-079/talk-to-your-textbook/blob/ff4062cee6ffbcd0016407684a7845f1e79559ce/cursors/s3.2025.png?raw=1" width="100%"/>
      </a>
    </td>
    <td width="50%">
      <strong>Sign In</strong><br/>
      <a href="https://github.com/Marques-079/talk-to-your-textbook/blob/ff4062cee6ffbcd0016407684a7845f1e79559ce/cursors/s4.2025.png">
        <img alt="Sign in screen" src="https://github.com/Marques-079/talk-to-your-textbook/blob/ff4062cee6ffbcd0016407684a7845f1e79559ce/cursors/s4.2025.png?raw=1" width="100%"/>
      </a>
    </td>
  </tr>
  <tr>
    <td colspan="2">
      <strong>Upload Docs & Chats Library</strong><br/>
      <a href="https://github.com/Marques-079/talk-to-your-textbook/blob/ff4062cee6ffbcd0016407684a7845f1e79559ce/cursors/s5.2025.png">
        <img alt="Upload docs and access chats library" src="https://github.com/Marques-079/talk-to-your-textbook/blob/ff4062cee6ffbcd0016407684a7845f1e79559ce/cursors/s5.2025.png?raw=1" width="100%"/>
      </a>
    </td>
  </tr>
</table>


---

## 📋 Features

- ✅ **Authentication**: NextAuth + JWT
- ✅ **Upload**: Direct-to-MinIO with presigned URLs
- ✅ **Ingestion**: PyMuPDF → BGE-M3 embeddings → FAISS
- ✅ **Q&A**: Vector search → GPT-4o mini → Streaming SSE
- ✅ **Citations**: Click `[p. N]` to navigate PDF viewer
- ✅ **Multi-user**: Per-user document isolation

---

## 🔒 Security

- Per-user document isolation
- JWT authentication
- Bcrypt password hashing
- Presigned upload URLs (no PDFs through API)
- SQL injection protection (SQLAlchemy ORM)

---

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
---
## 💻 Tech Stack

- **Backend**: FastAPI, SQLAlchemy, Alembic, RQ
- **Frontend**: Next.js 14, NextAuth, PDF.js, Tailwind
- **Database**: PostgreSQL 15
- **Storage**: MinIO (S3-compatible)
- **ML**: BGE-M3 (embeddings), GPT-4o mini (generation)
- **Search**: FAISS (HNSW)
