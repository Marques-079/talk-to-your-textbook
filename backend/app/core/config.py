from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = "postgresql://user:password@localhost:5432/textbook_qa"
    
    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"
    
    # MinIO
    MINIO_ENDPOINT: str = "localhost:9000"
    MINIO_ACCESS_KEY: str = "minioadmin"
    MINIO_SECRET_KEY: str = "minioadmin"
    MINIO_BUCKET: str = "textbook-pdfs"
    MINIO_SECURE: bool = False
    
    # Auth
    JWT_SECRET: str = "your-secret-key-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 10080  # 1 week
    
    # OpenAI
    OPENAI_API_KEY: str = ""
    
    # Feature flags
    ENABLE_BM25: bool = False
    ENABLE_RERANKER: bool = True
    ENABLE_FIGURES: bool = False
    
    # Models
    BGE_M3_MODEL_PATH: str = "BAAI/bge-m3"
    BGE_RERANKER_MODEL_PATH: str = "BAAI/bge-reranker-base"
    
    # Worker
    MAX_CONCURRENT_WORKERS: int = 2
    INGEST_TIMEOUT_SECONDS: int = 3600
    
    # HMAC
    HMAC_SECRET: str = "your-hmac-secret-change-in-production"
    
    # CORS
    CORS_ORIGINS: List[str] = ["http://localhost:3000"]
    
    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()

