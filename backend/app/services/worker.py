import redis
from rq import Queue
from app.core.config import settings

# Connect to Redis
redis_conn = redis.from_url(settings.REDIS_URL)
queue = Queue('default', connection=redis_conn)


def enqueue_ingest_job(doc_id: str, user_id: str):
    """Enqueue a document ingestion job"""
    # Import with the full path that the worker will use
    job = queue.enqueue(
        'tasks.ingest_document',  # String reference instead of function import
        doc_id=doc_id,
        user_id=user_id,
        job_timeout=settings.INGEST_TIMEOUT_SECONDS
    )
    return job


def get_job_status(doc_id: str):
    """Get the status of an ingestion job"""
    # For now, return a simple status
    # In production, you'd store job_id -> doc_id mapping
    return {"progress": None}