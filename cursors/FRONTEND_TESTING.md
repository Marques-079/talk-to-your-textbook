# Frontend Integration Testing Guide

## Prerequisites

✅ Backend services running:
```bash
docker compose ps
# Verify all services show "Up" or "healthy"
```

✅ Database migrated:
```bash
docker compose exec api alembic upgrade head
```

## Step 1: Setup Frontend Environment

### Create `.env.local` in `frontend/` directory:

```bash
cd frontend
cat > .env.local << 'EOF'
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-here-generate-with-openssl
NEXT_PUBLIC_API_URL=http://localhost:8000/api
EOF
```

**Generate a secure secret:**
```bash
openssl rand -base64 32
# Copy output and replace 'your-secret-here-generate-with-openssl' above
```

### Install dependencies (if not already done):
```bash
npm install
```

## Step 2: Start Frontend

```bash
npm run dev
```

Frontend will be available at: **http://localhost:3000**

## Step 3: Test Upload Flow

### 1. **Sign Up / Sign In**
- Navigate to http://localhost:3000
- Click "Sign Up" or "Sign In"
- Create an account or use existing credentials

### 2. **Upload a PDF**
- Go to "Library" page (from navigation)
- Click "Upload PDF" button
- Select a PDF file from your computer
- Watch the upload progress:
  - "Getting upload URL..."
  - "Uploading PDF..."
  - "Starting processing..."
  - "Processing complete!" (or error message)

### 3. **Monitor Backend**
Open a second terminal and watch the worker:
```bash
cd /path/to/talk-to-your-textbook
docker compose logs -f worker
```

You should see:
```
Extracting text from [filename]
Saving X pages
Chunking text
Created Y chunks
Generating embeddings
Loading BGE-M3 model: BAAI/bge-m3
Saving chunks to database
Document [doc-id] ingestion complete
Job OK
```

### 4. **Verify Document Status**
- The document should appear in your library
- Status should change: `queued` → `running` → `done`
- Page count should be displayed

## Step 4: Test Chat (Q&A)

### 1. **Open Document**
- Click on a processed document (status: `done`)
- You should see:
  - PDF viewer on the left
  - Chat interface on the right

### 2. **Ask Questions**
- Type a question related to the document content
- Press Enter or click Send
- Watch for:
  - Streaming response (SSE)
  - Citations appearing
  - PDF viewer highlighting relevant pages

## Troubleshooting

### Issue: "Network Error" or "401 Unauthorized"

**Check:**
1. Frontend `.env.local` exists with correct values
2. NextAuth secret is set
3. Clear browser cookies and re-sign in:
   ```bash
   # In browser DevTools Console
   document.cookie.split(";").forEach(c => {
     document.cookie = c.trim().split("=")[0] + "=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/";
   });
   ```

**Verify API is accessible:**
```bash
curl http://localhost:8000/api/auth/health  # Should return {"status":"ok"}
```

### Issue: Upload Stuck or Fails

**Check backend logs:**
```bash
docker compose logs api | tail -50
docker compose logs worker | tail -50
```

**Common causes:**
- MinIO not running: `docker compose ps minio`
- Worker not processing: `docker compose restart worker`
- Database not migrated: `docker compose exec api alembic upgrade head`

**Verify MinIO is accessible:**
```bash
curl http://localhost:9000/minio/health/live
# Should return 200 OK
```

### Issue: Document Stuck in "queued" or "running"

**Check worker:**
```bash
docker compose logs worker | grep -i error
```

**Restart worker:**
```bash
docker compose restart worker
```

**Check Redis:**
```bash
docker compose exec redis redis-cli ping
# Should return "PONG"
```

### Issue: No PDF Preview in Chat

**Check browser console:**
- Open DevTools → Console
- Look for errors related to PDF.js or CORS

**Verify MinIO bucket:**
```bash
docker compose exec minio sh -c "mc alias set local http://localhost:9000 minioadmin minioadmin && mc ls local/textbook-pdfs/"
```

## Testing with Sample PDF

If you don't have a PDF handy, create a simple one:

**Using LibreOffice/Word:**
1. Create a document with some text
2. Export as PDF

**Using macOS:**
```bash
# Create a simple PDF from a webpage
/System/Library/Printers/Libraries/convert -f /System/Library/Frameworks/Quartz.framework/Resources/hello.html -o ~/test.pdf
```

**Or use a public domain PDF:**
- Download from: https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf

## Expected Behavior

### Successful Upload
1. File uploads to MinIO (browser → presigned URL)
2. Backend creates document record (status: `queued`)
3. Worker picks up job
4. Worker downloads PDF from MinIO
5. Text extraction completes
6. Chunks are created
7. Embeddings generated
8. FAISS index created
9. Document status → `done`
10. Document appears in library with page count

### Processing Time
- **Small PDF** (< 10 pages): 10-20 seconds
- **Medium PDF** (10-50 pages): 30-60 seconds
- **Large PDF** (100+ pages): 2-5 minutes

First upload after worker restart adds ~5-10 seconds for model loading.

## Next Steps

Once document upload works:
1. Test Q&A functionality in chat
2. Verify citations are accurate
3. Test PDF highlighting
4. Check streaming responses
5. Test multiple documents

## Useful Commands

**View all documents in database:**
```bash
docker compose exec db psql -U postgres -d ttyt -c "SELECT id, title, status, page_count FROM documents;"
```

**Clear all test data:**
```bash
docker compose exec db psql -U postgres -d ttyt -c "DELETE FROM documents;"
docker compose exec minio sh -c "mc alias set local http://localhost:9000 minioadmin minioadmin && mc rm --recursive --force local/textbook-pdfs/*"
```

**Restart all services:**
```bash
docker compose down
docker compose up -d
# Wait 30 seconds for services to be healthy
docker compose logs -f
```

## API Testing (Optional)

Test endpoints directly with curl:

**Sign in:**
```bash
TOKEN=$(curl -s -X POST http://localhost:8000/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"testpass"}' | jq -r '.access_token')
```

**List documents:**
```bash
curl -H "Authorization: Bearer $TOKEN" http://localhost:8000/api/documents
```

**Get presigned URL:**
```bash
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8000/api/presign?filename=test.pdf&content_type=application/pdf"
```

