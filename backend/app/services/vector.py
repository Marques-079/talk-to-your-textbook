import os
import numpy as np
import faiss
from typing import List, Tuple
from sentence_transformers import SentenceTransformer

from app.core.config import settings


class VectorService:
    def __init__(self):
        self.model = None
        self.dimension = 1024  # BGE-M3 dimension
        self.indexes = {}  # Cache for loaded indexes
    
    def _ensure_model_loaded(self):
        if self.model is None:
            print(f"Loading BGE-M3 model: {settings.BGE_M3_MODEL_PATH}")
            self.model = SentenceTransformer(settings.BGE_M3_MODEL_PATH)
            # Optimize for int8 quantization if possible
            # For now, we'll use FP32 and quantize later if needed
    
    def embed_texts(self, texts: List[str]) -> np.ndarray:
        """Generate embeddings for a list of texts"""
        self._ensure_model_loaded()
        embeddings = self.model.encode(texts, normalize_embeddings=True)
        return embeddings
    
    def create_index(self, user_id: str, doc_id: str, texts: List[str]) -> Tuple[faiss.Index, List[int]]:
        """Create a FAISS index for document chunks"""
        embeddings = self.embed_texts(texts)
        
        # Create HNSW index for efficient similarity search
        index = faiss.IndexHNSWFlat(self.dimension, 32)
        index.hnsw.efConstruction = 40
        index.hnsw.efSearch = 16
        
        # Add vectors
        index.add(embeddings.astype('float32'))
        
        # Save index
        index_path = self._get_index_path(user_id, doc_id)
        os.makedirs(os.path.dirname(index_path), exist_ok=True)
        faiss.write_index(index, index_path)
        
        # Return vector IDs (0 to len-1)
        vector_ids = list(range(len(texts)))
        
        return index, vector_ids
    
    def search(self, user_id: str, doc_id: str, query: str, top_k: int = 10) -> List[Tuple[int, float]]:
        """Search for similar chunks"""
        # Load index if not cached
        index_key = f"{user_id}/{doc_id}"
        if index_key not in self.indexes:
            index_path = self._get_index_path(user_id, doc_id)
            if not os.path.exists(index_path):
                return []
            self.indexes[index_key] = faiss.read_index(index_path)
        
        index = self.indexes[index_key]
        
        # Embed query
        query_embedding = self.embed_texts([query])[0]
        
        # Search
        distances, indices = index.search(
            query_embedding.reshape(1, -1).astype('float32'),
            top_k
        )
        
        # Return (vector_id, score) pairs
        results = [
            (int(indices[0][i]), float(distances[0][i]))
            for i in range(len(indices[0]))
            if indices[0][i] != -1
        ]
        
        return results
    
    def delete_index(self, user_id: str, doc_id: str):
        """Delete a FAISS index"""
        index_path = self._get_index_path(user_id, doc_id)
        if os.path.exists(index_path):
            os.remove(index_path)
        
        index_key = f"{user_id}/{doc_id}"
        if index_key in self.indexes:
            del self.indexes[index_key]
    
    def _get_index_path(self, user_id: str, doc_id: str) -> str:
        return f"/data/faiss/{user_id}/{doc_id}/index.faiss"


vector_service = VectorService()

