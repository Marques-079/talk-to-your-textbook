#!/usr/bin/env python3
"""
RQ Worker
Processes background jobs from Redis queue
"""
import sys
import os

# Add both backend AND worker to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))
sys.path.insert(0, os.path.dirname(__file__))  # Add worker directory

from redis import Redis
from rq import Worker, Queue
from app.core.config import settings

# Import tasks so RQ can find them
import tasks  # This makes tasks.ingest_document available

# Connect to Redis
redis_conn = Redis.from_url(settings.REDIS_URL)

if __name__ == '__main__':
    # Create worker
    queue = Queue('default', connection=redis_conn)
    worker = Worker([queue], connection=redis_conn)
    
    print("Starting RQ worker...")
    print(f"Connected to Redis: {settings.REDIS_URL}")
    print(f"Listening on queue: default")
    
    # Start processing jobs
    worker.work()