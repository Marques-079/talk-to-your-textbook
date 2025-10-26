# Worker Error Fixes

## 🐛 Errors Fixed

### Error 1: SQLAlchemy Relationship Error
```
sqlalchemy.exc.InvalidRequestError: When initializing mapper Mapper[Document(documents)], 
expression 'Chat' failed to locate a name ('Chat')
```

**Cause**: The `Document` model has a relationship to `Chat`, but the worker wasn't importing the `Chat` model, so SQLAlchemy couldn't resolve the relationship.

**Fix**: Import all related models in `worker/tasks.py`:
```python
# Before:
from app.models.document import Document, Page, Chunk

# After:
from app.models.document import Document, Page, Chunk, Figure
from app.models.chat import Chat, Message, Citation
```

### Error 2: UnboundLocalError
```
UnboundLocalError: cannot access local variable 'document' where it is not associated with a value
```

**Cause**: In the exception handler, we tried to access `document.status` but if the error occurred during the initial query, `document` was never assigned.

**Fix**: Initialize `document = None` at the start and check before accessing:
```python
# Before:
def ingest_document(doc_id: str, user_id: str):
    db = SessionLocal()
    try:
        document = db.query(Document)...
        ...
    except Exception as e:
        document.status = "error"  # Might not exist!

# After:
def ingest_document(doc_id: str, user_id: str):
    db = SessionLocal()
    document = None  # Initialize
    try:
        document = db.query(Document)...
        ...
    except Exception as e:
        if document:  # Check before using
            document.status = "error"
```

## ✅ Changes Made

### File: `worker/tasks.py`

**Line 9-10**: Added missing imports
```python
from app.models.document import Document, Page, Chunk, Figure
from app.models.chat import Chat, Message, Citation
```

**Line 30**: Initialize document variable
```python
document = None  # Initialize to avoid UnboundLocalError
```

**Line 137-140**: Check document exists before updating
```python
if document:  # Only update if document was found
    document.status = "error"
    document.error_message = str(e)
    db.commit()
```

## 🧪 Testing

After the fixes, upload a PDF and watch the worker process it:

```bash
# Watch worker logs in real-time
docker compose logs -f worker

# Expected output:
# - Extracting text from filename.pdf
# - Saving X pages
# - Chunking text
# - Created X chunks
# - Generating embeddings (this takes time on first run)
# - Saving chunks to database
# - Document abc-123 ingestion complete
```

## 🚀 Next Steps

1. **Upload a PDF** at http://localhost:3000/library
2. **Worker should process it** - status will change from "Queued" → "Ready"
3. **First run will be slow** - BGE-M3 model downloads (~900MB, 5-10 min)
4. **Subsequent uploads will be faster** - model is cached

## 📊 Complete Pipeline Status

✅ Frontend authentication working  
✅ PDF upload to MinIO working (after .env fix)  
✅ Job enqueuing to Redis working  
✅ Worker picking up jobs working  
✅ SQLAlchemy models resolved  
✅ Error handling improved  
⏳ Awaiting BGE-M3 model download on first run  

---

**Status**: Worker fixes applied, ready to process documents!

