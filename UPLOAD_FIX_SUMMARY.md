# Upload Issue Fix Summary

## 🐛 Problems Identified

### 1. **MinIO Endpoint Configuration**
- **Issue**: `.env` had `MINIO_ENDPOINT=http://minio:9000` (with http:// prefix)
- **Problem**: The storage service adds http:// automatically, causing double prefix
- **Fix**: Change to `MINIO_ENDPOINT=minio:9000` (without http://)

### 2. **Wrong Bucket Name**
- **Issue**: `.env` had `MINIO_BUCKET=uploads`
- **Problem**: Code expects `MINIO_BUCKET=textbook-pdfs`
- **Fix**: Change bucket name to match code expectation

### 3. **Presigned URLs Not Browser-Accessible**
- **Issue**: Presigned URLs contained `minio:9000` which browsers can't resolve
- **Problem**: `minio` is a Docker internal hostname, not accessible from host browser
- **Fix**: Modified `storage.py` to replace `minio:9000` with `localhost:9000` in presigned URLs

## ✅ Changes Made

### File: `backend/app/services/storage.py`

```python
# Before:
def generate_presigned_upload_url(self, object_key: str, content_type: str, expires_in: int = 3600) -> str:
    url = self.client.generate_presigned_url(...)
    return url

# After:
def generate_presigned_upload_url(self, object_key: str, content_type: str, expires_in: int = 3600) -> str:
    url = self.client.generate_presigned_url(...)
    # Replace minio with localhost for browser access
    url = url.replace('minio:9000', 'localhost:9000')
    return url
```

Same fix applied to `generate_presigned_download_url()`.

### File: `.env` (MANUAL EDIT REQUIRED)

**Before:**
```env
MINIO_ENDPOINT=http://minio:9000
MINIO_BUCKET=uploads
```

**After:**
```env
MINIO_ENDPOINT=minio:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=textbook-pdfs
MINIO_SECURE=false
```

## 🔧 Steps to Complete Fix

1. **Edit `.env` file** (manually, as it's gitignored):
   ```bash
   # Open .env in your editor
   nano .env
   # OR
   code .env
   ```

2. **Make these changes**:
   - Find: `MINIO_ENDPOINT=http://minio:9000`
   - Replace with: `MINIO_ENDPOINT=minio:9000`
   
   - Find: `MINIO_BUCKET=uploads`
   - Replace with: `MINIO_BUCKET=textbook-pdfs`
   
   - Ensure these lines exist:
   ```
   MINIO_ACCESS_KEY=minioadmin
   MINIO_SECRET_KEY=minioadmin
   MINIO_SECURE=false
   ```

3. **Restart services**:
   ```bash
   docker compose restart api worker
   ```

4. **Test upload**:
   - Go to http://localhost:3000/library
   - Upload a PDF
   - Should see "Uploading PDF..." then status change to "Queued"
   - Worker logs should show processing

## 🧪 How to Verify It's Working

### Check Presigned URL Format:
```bash
# Should contain localhost:9000, not minio:9000
docker compose logs api | grep presign
```

### Watch Worker Process Document:
```bash
docker compose logs -f worker

# Should see:
# - Extracting text from filename.pdf
# - Saving X pages
# - Chunking text
# - Created X chunks
# - Generating embeddings
# - Document abc-123 ingestion complete
```

### Check MinIO for Uploaded Files:
```bash
# List bucket contents
docker compose exec minio mc ls local/textbook-pdfs/
```

## 🎯 Expected Flow After Fix

1. **User selects PDF** → Frontend calls `/api/presign`
2. **Backend generates presigned URL** → URL contains `localhost:9000` (browser accessible)
3. **Browser uploads directly to MinIO** → File stored in `textbook-pdfs` bucket
4. **Frontend calls `/api/ingest`** → Job enqueued in Redis
5. **Worker picks up job** → Downloads PDF, extracts text, generates embeddings
6. **Document status updates** → Queued → Running → Done
7. **User can open chat** → Click "Open" button to start asking questions

## 🚨 Common Issues

### If upload still fails:

**Check browser console (F12 → Console tab)**:
- Look for CORS errors
- Check the presigned URL - should have `localhost:9000`

**Check API logs**:
```bash
docker compose logs api | grep -i error
```

**Check if MinIO is accessible**:
```bash
curl http://localhost:9000/minio/health/live
# Should return empty 200 OK
```

**Verify .env changes loaded**:
```bash
docker compose restart api worker
docker compose logs api | head -20
# Should not show errors about bucket/endpoint
```

## 📋 Pipeline Overview

```
┌─────────────┐
│   Browser   │
└──────┬──────┘
       │ 1. Request presigned URL
       ↓
┌─────────────┐
│  FastAPI    │ 2. Generate URL with localhost:9000
└──────┬──────┘
       │ 3. Return URL to browser
       ↓
┌─────────────┐
│   Browser   │ 4. PUT file directly to MinIO
└──────┬──────┘
       │ 5. Call /api/ingest
       ↓
┌─────────────┐
│  FastAPI    │ 6. Enqueue job in Redis
└──────┬──────┘
       │
       ↓
┌─────────────┐
│ RQ Worker   │ 7. Process job:
│             │    - Download from MinIO
│             │    - Extract text (PyMuPDF)
│             │    - Chunk paragraphs
│             │    - Generate embeddings (BGE-M3)
│             │    - Save to Postgres + FAISS
└─────────────┘
```

## ✨ Success Indicators

- ✅ No "Failed to upload document" errors
- ✅ Documents appear with "Queued" status
- ✅ Worker logs show processing activity
- ✅ Document status changes to "Ready"
- ✅ Can click "Open" and ask questions
- ✅ MinIO bucket contains PDF files

---

**Last Updated**: 2025-10-25
**Status**: Fixes applied, awaiting .env manual edit

