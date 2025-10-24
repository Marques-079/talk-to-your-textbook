import os
import tempfile
import uuid
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import fitz  # PyMuPDF

from app.core.config import settings
from app.models.user import User
from app.models.document import Document, Page, Chunk, Figure
from app.models.chat import Chat, Message, Citation
from app.services.storage import storage_service
from app.services.vector import vector_service


# Create database session
engine = create_engine(settings.DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def ingest_document(doc_id: str, user_id: str):
    """
    Main ingestion task:
    1. Download PDF from MinIO
    2. Extract text per page with PyMuPDF
    3. Chunk paragraphs
    4. Generate embeddings and create FAISS index
    5. Save everything to database
    """
    db = SessionLocal()
    document = None  # Initialize to avoid UnboundLocalError
    
    try:
        # Get document
        document = db.query(Document).filter(Document.id == uuid.UUID(doc_id)).first()
        if not document:
            print(f"Document {doc_id} not found")
            return
        
        # Update status
        document.status = "running"
        db.commit()
        
        # Download PDF from MinIO
        object_key = f"{user_id}/{doc_id}/{document.filename}"
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp_file:
            tmp_path = tmp_file.name
        
        try:
            storage_service.download_file(object_key, tmp_path)
            
            # Extract text from PDF
            print(f"Extracting text from {document.filename}")
            pdf_doc = fitz.open(tmp_path)
            
            pages_data = []
            for page_num in range(len(pdf_doc)):
                page = pdf_doc[page_num]
                text = page.get_text()
                
                if text.strip():  # Only process pages with text
                    pages_data.append({
                        "page_number": page_num + 1,  # 1-indexed
                        "text": text
                    })
            
            pdf_doc.close()
            
            # Update page count
            document.page_count = len(pages_data)
            db.commit()
            
            # Save pages to database
            print(f"Saving {len(pages_data)} pages")
            page_records = []
            for page_data in pages_data:
                page_record = Page(
                    document_id=document.id,
                    page_number=page_data["page_number"],
                    text=page_data["text"]
                )
                db.add(page_record)
                db.flush()
                page_records.append(page_record)
            
            db.commit()
            
            # Chunk text
            print("Chunking text")
            chunks_data = []
            for page_record, page_data in zip(page_records, pages_data):
                page_chunks = chunk_text(
                    page_data["text"],
                    page_number=page_data["page_number"]
                )
                for chunk_info in page_chunks:
                    chunks_data.append({
                        "page_id": page_record.id,
                        "page_number": page_data["page_number"],
                        **chunk_info
                    })
            
            print(f"Created {len(chunks_data)} chunks")
            
            # Generate embeddings and create FAISS index
            print("Generating embeddings")
            chunk_texts = [c["text"] for c in chunks_data]
            index, vector_ids = vector_service.create_index(user_id, doc_id, chunk_texts)
            
            # Save chunks to database with vector IDs
            print("Saving chunks to database")
            for chunk_data, vector_id in zip(chunks_data, vector_ids):
                chunk_record = Chunk(
                    document_id=document.id,
                    page_id=chunk_data["page_id"],
                    page_number=chunk_data["page_number"],
                    text=chunk_data["text"],
                    char_start=chunk_data["char_start"],
                    char_end=chunk_data["char_end"],
                    vector_id=vector_id
                )
                db.add(chunk_record)
            
            db.commit()
            
            # Mark as done
            document.status = "done"
            db.commit()
            print(f"Document {doc_id} ingestion complete")
            
        finally:
            # Clean up temp file
            if os.path.exists(tmp_path):
                os.remove(tmp_path)
    
    except Exception as e:
        print(f"Error ingesting document {doc_id}: {e}")
        if document:  # Only update if document was found
            document.status = "error"
            document.error_message = str(e)
            db.commit()
        raise
    
    finally:
        db.close()


def chunk_text(text: str, page_number: int, chunk_size: int = 600, overlap: int = 80):
    """
    Chunk text into overlapping segments.
    Simple implementation - in production, use paragraph-aware chunking.
    """
    chunks = []
    
    # Split by double newlines (paragraphs)
    paragraphs = text.split('\n\n')
    
    current_chunk = ""
    char_start = 0
    
    for para in paragraphs:
        para = para.strip()
        if not para:
            continue
        
        # If adding this paragraph exceeds chunk_size, save current chunk
        if current_chunk and len(current_chunk) + len(para) > chunk_size:
            chunks.append({
                "text": current_chunk.strip(),
                "char_start": char_start,
                "char_end": char_start + len(current_chunk)
            })
            
            # Start new chunk with overlap
            overlap_text = current_chunk[-overlap:] if len(current_chunk) > overlap else current_chunk
            current_chunk = overlap_text + " " + para
            char_start = char_start + len(current_chunk) - len(overlap_text) - len(para) - 1
        else:
            if current_chunk:
                current_chunk += " " + para
            else:
                current_chunk = para
    
    # Add final chunk
    if current_chunk:
        chunks.append({
            "text": current_chunk.strip(),
            "char_start": char_start,
            "char_end": char_start + len(current_chunk)
        })
    
    return chunks

