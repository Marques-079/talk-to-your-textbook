from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List
import uuid

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.document import Document
from app.models.chat import Chat, Message, Citation

router = APIRouter()


class CreateChatRequest(BaseModel):
    document_id: str
    title: str | None = None


class ChatResponse(BaseModel):
    id: str
    user_id: str
    document_id: str
    title: str
    created_at: str
    updated_at: str


class CitationResponse(BaseModel):
    id: str
    page_number: int
    figure_num: int | None
    char_start: int | None
    char_end: int | None
    bbox: dict | None


class MessageResponse(BaseModel):
    id: str
    role: str
    content: str
    created_at: str


class MessageWithCitationsResponse(BaseModel):
    message: MessageResponse
    citations: List[CitationResponse]


@router.get("", response_model=List[ChatResponse])
def list_chats(
    document_id: str | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(Chat).filter(Chat.user_id == current_user.id)
    
    if document_id:
        query = query.filter(Chat.document_id == uuid.UUID(document_id))
    
    chats = query.order_by(Chat.updated_at.desc()).all()
    
    return [
        ChatResponse(
            id=str(chat.id),
            user_id=str(chat.user_id),
            document_id=str(chat.document_id),
            title=chat.title,
            created_at=chat.created_at.isoformat(),
            updated_at=chat.updated_at.isoformat()
        )
        for chat in chats
    ]


@router.post("", response_model=ChatResponse)
def create_chat(
    request: CreateChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Verify document exists and belongs to user
    document = db.query(Document).filter(
        Document.id == uuid.UUID(request.document_id),
        Document.user_id == current_user.id
    ).first()
    
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Create chat
    title = request.title or f"Chat about {document.title}"
    chat = Chat(
        user_id=current_user.id,
        document_id=document.id,
        title=title
    )
    db.add(chat)
    db.commit()
    db.refresh(chat)
    
    return ChatResponse(
        id=str(chat.id),
        user_id=str(chat.user_id),
        document_id=str(chat.document_id),
        title=chat.title,
        created_at=chat.created_at.isoformat(),
        updated_at=chat.updated_at.isoformat()
    )


@router.get("/{chat_id}/messages", response_model=List[MessageWithCitationsResponse])
def get_messages(
    chat_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Verify chat belongs to user
    chat = db.query(Chat).filter(
        Chat.id == uuid.UUID(chat_id),
        Chat.user_id == current_user.id
    ).first()
    
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    
    # Get messages with citations
    messages = db.query(Message).filter(
        Message.chat_id == chat.id
    ).order_by(Message.created_at).all()
    
    result = []
    for message in messages:
        citations = [
            CitationResponse(
                id=str(cit.id),
                page_number=cit.page_number,
                figure_num=cit.figure_num,
                char_start=cit.char_start,
                char_end=cit.char_end,
                bbox={
                    "x": cit.bbox_x,
                    "y": cit.bbox_y,
                    "width": cit.bbox_width,
                    "height": cit.bbox_height
                } if cit.bbox_x is not None else None
            )
            for cit in message.citations
        ]
        
        result.append(MessageWithCitationsResponse(
            message=MessageResponse(
                id=str(message.id),
                role=message.role,
                content=message.content,
                created_at=message.created_at.isoformat()
            ),
            citations=citations
        ))
    
    return result


@router.delete("/{chat_id}")
def delete_chat(
    chat_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Verify chat belongs to user
    chat = db.query(Chat).filter(
        Chat.id == uuid.UUID(chat_id),
        Chat.user_id == current_user.id
    ).first()
    
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    
    # Delete (cascade will handle messages and citations)
    db.delete(chat)
    db.commit()
    
    return {"success": True}

