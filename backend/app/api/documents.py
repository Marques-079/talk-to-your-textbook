from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List
import uuid
from datetime import datetime, timedelta

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.document import Document
from app.services.storage import storage_service
from app.services.worker import enqueue_ingest_job, get_job_status

router = APIRouter()


class PresignResponse(BaseModel):
    doc_id: str
    upload_url: str
    expires_in: int


class IngestResponse(BaseModel):
    success: bool
    document: dict


class DocumentResponse(BaseModel):
    id: str
    user_id: str
    title: str
    filename: str
    status: str
    error_message: str | None
    page_count: int | None
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True


class IngestStatusResponse(BaseModel):
    status: str
    progress: float | None = None
    error_message: str | None = None


@router.get("/presign", response_model=PresignResponse)
def get_presign_url(
    filename: str = Query(...),
    content_type: str = Query(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Create document record
    doc_id = str(uuid.uuid4())
    title = filename.rsplit(".", 1)[0]  # Remove extension
    
    document = Document(
        id=uuid.UUID(doc_id),
        user_id=current_user.id,
        title=title,
        filename=filename,
        status="queued"
    )
    db.add(document)
    db.commit()
    
    # Generate presigned URL
    object_key = f"{current_user.id}/{doc_id}/{filename}"
    upload_url = storage_service.generate_presigned_upload_url(
        object_key=object_key,
        content_type=content_type,
        expires_in=3600
    )
    
    return PresignResponse(
        doc_id=doc_id,
        upload_url=upload_url,
        expires_in=3600
    )


@router.post("/ingest", response_model=IngestResponse)
def ingest_document(
    doc_id: str = Query(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Get document
    document = db.query(Document).filter(
        Document.id == uuid.UUID(doc_id),
        Document.user_id == current_user.id
    ).first()
    
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Enqueue worker job
    job = enqueue_ingest_job(doc_id=doc_id, user_id=str(current_user.id))
    
    # Update status
    document.status = "queued"
    db.commit()
    db.refresh(document)
    
    return IngestResponse(
        success=True,
        document={
            "id": str(document.id),
            "title": document.title,
            "status": document.status
        }
    )


@router.get("/ingest/status", response_model=IngestStatusResponse)
def get_ingest_status(
    doc_id: str = Query(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Get document
    document = db.query(Document).filter(
        Document.id == uuid.UUID(doc_id),
        Document.user_id == current_user.id
    ).first()
    
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Check job status if queued/running
    job_status = None
    if document.status in ["queued", "running"]:
        job_status = get_job_status(doc_id)
    
    return IngestStatusResponse(
        status=document.status,
        progress=job_status.get("progress") if job_status else None,
        error_message=document.error_message
    )


@router.get("/documents", response_model=List[DocumentResponse])
def list_documents(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    documents = db.query(Document).filter(
        Document.user_id == current_user.id
    ).order_by(Document.created_at.desc()).all()
    
    return [
        DocumentResponse(
            id=str(doc.id),
            user_id=str(doc.user_id),
            title=doc.title,
            filename=doc.filename,
            status=doc.status,
            error_message=doc.error_message,
            page_count=doc.page_count,
            created_at=doc.created_at.isoformat(),
            updated_at=doc.updated_at.isoformat()
        )
        for doc in documents
    ]


@router.delete("/documents/{doc_id}")
def delete_document(
    doc_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Get document
    document = db.query(Document).filter(
        Document.id == uuid.UUID(doc_id),
        Document.user_id == current_user.id
    ).first()
    
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Delete from storage
    try:
        object_key = f"{current_user.id}/{doc_id}/{document.filename}"
        storage_service.delete_object(object_key)
    except Exception as e:
        print(f"Failed to delete object: {e}")
    
    # Delete FAISS index
    from app.services.vector import vector_service
    vector_service.delete_index(str(current_user.id), doc_id)
    
    # Delete from database (cascade will handle related records)
    db.delete(document)
    db.commit()
    
    return {"success": True}

