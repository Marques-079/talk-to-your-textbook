# Upload & Processing Test Guide

## ✅ All Fixes Applied

1. **Storage Service**: Presigned URLs use `localhost:9000` for browser access
2. **Worker Models**: All required models imported (`User`, `Document`, `Page`, `Chunk`, `Figure`, `Chat`, `Message`, `Citation`)
3. **Error Handling**: Safe exception handling with null checks

## 🧪 Test the Upload Pipeline

### Step 1: Watch Worker Logs

Open a terminal and run:
```bash
cd /Users/marcus/Documents/GitHub/talk-to-your-textbook
docker compose logs -f worker
```

Keep this terminal open to watch processing in real-time.

### Step 2: Upload a Test PDF

1. Go to **http://localhost:3000/library**
2. Click **"Choose file"**
3. Select a PDF (start with a small one, 5-20 pages)
4. Watch the upload progress

### Step 3: Verify Processing

**In the browser**, you should see:
- "Uploading PDF..." → Brief
- Document appears with "Queued" badge → Immediately
- "Processing..." badge → After a few seconds
- "Ready" badge → After processing completes

**In the worker logs terminal**, you should see:
```
13:XX:XX default: tasks.ingest_document(doc_id='...', user_id='...')
Extracting text from filename.pdf
Saving 15 pages
Chunking text
Created 45 chunks
Loading BGE-M3 model: BAAI/bge-m3  ← First time only, downloads ~900MB
Generating embeddings
Saving chunks to database
Document abc-123 ingestion complete
13:XX:XX Job completed successfully
```

### Step 4: Test Q&A

Once status is "Ready":
1. Click **"Open"** button
2. Chat interface should load with PDF viewer on right
3. Ask a question: "What is this document about?"
4. Should get a streaming answer with citations

## ⏰ Expected Timings

### First Upload (BGE-M3 model download)
- **Queued → Processing**: ~5 seconds
- **Model Download**: ~5-10 minutes (900MB download)
- **Text Extraction**: ~10-30 seconds per 100 pages
- **Embedding Generation**: ~1-3 minutes per 100 pages
- **Total**: ~10-15 minutes

### Subsequent Uploads (model cached)
- **Queued → Processing**: ~5 seconds
- **Text Extraction**: ~10-30 seconds per 100 pages
- **Embedding Generation**: ~1-3 minutes per 100 pages
- **Total**: ~2-5 minutes per 100 pages

## 🐛 Troubleshooting

### Upload Fails with "Failed to upload document"

**Check browser console (F12 → Console tab)**:
- Look for red errors
- Check the presigned URL - should contain `localhost:9000`

**Check if .env was edited**:
```bash
cat .env | grep MINIO
# Should show:
# MINIO_ENDPOINT=minio:9000  (NOT http://minio:9000)
# MINIO_BUCKET=textbook-pdfs  (NOT uploads)
```

If wrong, edit `.env` and restart:
```bash
docker compose restart api worker
```

### Document Stuck on "Queued"

**Check worker is running**:
```bash
docker compose ps worker
# Should show: Up
```

**Check worker logs for errors**:
```bash
docker compose logs worker --tail 50
```

**Restart worker**:
```bash
docker compose restart worker
```

### Document Status Changes to "Error"

**Check worker logs**:
```bash
docker compose logs worker | grep -A 20 "exception raised"
```

**Common causes**:
- MinIO can't download PDF → Check bucket name in `.env`
- Out of memory → Reduce max workers or increase Docker memory
- Model download interrupted → Delete `~/.cache/huggingface/` and retry

### "Ready" But Can't Ask Questions

**Check API logs**:
```bash
docker compose logs api | grep -i error
```

**Verify FAISS index created**:
```bash
docker compose exec worker ls -lh /data/faiss/
# Should show user_id/doc_id/index.faiss files
```

## 🎯 Success Checklist

- [ ] Upload shows progress ("Uploading PDF...")
- [ ] Document appears in library with "Queued" status
- [ ] Worker logs show job picked up
- [ ] Worker logs show "Extracting text from..."
- [ ] Worker logs show "Generating embeddings"
- [ ] Worker logs show "Document abc-123 ingestion complete"
- [ ] Document status changes to "Ready"
- [ ] Can click "Open" button
- [ ] Chat interface loads
- [ ] Can ask question and get answer
- [ ] Answer has citations like [p. 5]
- [ ] Clicking citation scrolls PDF viewer

## 📊 Monitoring Commands

```bash
# Watch worker in real-time
docker compose logs -f worker

# Check all services status
docker compose ps

# Check API logs
docker compose logs api --tail 50

# Check MinIO bucket
docker compose exec minio mc ls local/textbook-pdfs/

# Check database documents
docker compose exec db psql -U user textbook_qa -c "SELECT id, title, status FROM documents;"

# Check FAISS indexes
docker compose exec worker ls -lR /data/faiss/
```

## 🚀 Quick Recovery

If something goes wrong:

```bash
# Clean restart
docker compose restart worker api

# Nuclear option (deletes all data!)
docker compose down -v
docker compose up -d
docker compose exec api alembic upgrade head
```

---

**All fixes applied. Worker is ready to process documents!** 🎉

Upload a PDF and watch it process in the worker logs!

