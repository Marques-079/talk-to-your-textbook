FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY backend/requirements.txt /app/requirements.txt
COPY worker/requirements.txt /app/worker-requirements.txt

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy code
COPY backend /app/backend
COPY worker /app/worker
WORKDIR /app/worker

# Create data directory for FAISS
RUN mkdir -p /data/faiss

CMD ["python", "worker.py"]

