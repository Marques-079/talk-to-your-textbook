# MinIO Bucket Fix

## 🐛 Problem Identified

**Error**: `botocore.exceptions.ClientError: An error occurred (404) when calling the HeadObject operation: Not Found`

**Root Cause**: The `textbook-pdfs` bucket didn't exist in MinIO, so uploaded files had nowhere to go.

## ✅ Fix Applied

### 1. Created the Bucket

```bash
docker compose exec minio sh -c "mc alias set local http://localhost:9000 minioadmin minioadmin && mc mb local/textbook-pdfs"
```

### 2. Set Public Access

```bash
docker compose exec minio sh -c "mc anonymous set public local/textbook-pdfs"
```

### 3. Enhanced Storage Service

Modified `backend/app/services/storage.py` to log bucket status and handle creation better:

```python
def _ensure_bucket_exists(self):
    try:
        self.client.head_bucket(Bucket=self.bucket)
        print(f"MinIO bucket '{self.bucket}' exists")
    except ClientError as e:
        print(f"Creating MinIO bucket '{self.bucket}'...")
        try:
            self.client.create_bucket(Bucket=self.bucket)
            print(f"MinIO bucket '{self.bucket}' created successfully")
        except Exception as create_error:
            print(f"Failed to create bucket: {create_error}")
            raise
```

## 🧪 Testing

Now upload should work! The complete flow:

1. **Browser requests presigned URL** → API returns URL with `localhost:9000/textbook-pdfs/...`
2. **Browser uploads PDF** → MinIO saves to `textbook-pdfs` bucket
3. **API enqueues job** → Redis queue
4. **Worker downloads PDF** → From MinIO `textbook-pdfs` bucket ✅
5. **Worker processes** → Extract text, generate embeddings
6. **Document ready** → Status changes to "Ready"

## 🔍 Verify Bucket Exists

```bash
# List buckets
docker compose exec minio sh -c "mc alias set local http://localhost:9000 minioadmin minioadmin && mc ls local/"

# List bucket contents (after upload)
docker compose exec minio sh -c "mc alias set local http://localhost:9000 minioadmin minioadmin && mc ls local/textbook-pdfs/"
```

## 📊 Complete Pipeline Status

✅ MinIO bucket created  
✅ Bucket set to public  
✅ Storage service enhanced  
✅ All code fixes applied  
✅ Worker ready  

**Ready to test upload!**

## 🚀 Test Now

1. Go to http://localhost:3000/library
2. Upload a PDF
3. Watch worker logs: `docker compose logs -f worker`
4. Should see successful processing!

---

**Status**: Bucket created, all fixes applied, ready for testing!

