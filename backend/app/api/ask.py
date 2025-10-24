from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
import uuid
import json
from datetime import datetime

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.chat import Chat, Message, Citation
from app.services.qa import qa_service

router = APIRouter()


class AskRequest(BaseModel):
    chat_id: str
    question: str


@router.post("/ask")
async def ask_question(
    request: AskRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Verify chat belongs to user
    chat = db.query(Chat).filter(
        Chat.id == uuid.UUID(request.chat_id),
        Chat.user_id == current_user.id
    ).first()
    
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    
    # Create user message
    user_message = Message(
        chat_id=chat.id,
        role="user",
        content=request.question
    )
    db.add(user_message)
    db.commit()
    
    # Extract values before async generator to avoid SQLAlchemy session issues
    user_id_str = str(current_user.id)
    document_id_str = str(chat.document_id)
    chat_id_uuid = chat.id
    
    async def event_stream():
        try:
            # Generate answer with streaming
            answer_text = ""
            citations_data = []
            
            async for event in qa_service.answer_question(
                user_id=user_id_str,
                document_id=document_id_str,
                question=request.question,
                db=db
            ):
                if event["type"] == "token":
                    answer_text += event["content"]
                    yield f"data: {json.dumps(event)}\n\n"
                elif event["type"] == "citation":
                    citations_data.append(event["citation"])
                    yield f"data: {json.dumps(event)}\n\n"
                elif event["type"] == "error":
                    yield f"data: {json.dumps(event)}\n\n"
                    return
            
            # Save assistant message and citations
            assistant_message = Message(
                chat_id=chat_id_uuid,
                role="assistant",
                content=answer_text
            )
            db.add(assistant_message)
            db.flush()
            
            # Save citations
            for cit_data in citations_data:
                citation = Citation(
                    message_id=assistant_message.id,
                    page_number=cit_data["page_number"],
                    figure_num=cit_data.get("figure_num"),
                    char_start=cit_data.get("char_start"),
                    char_end=cit_data.get("char_end"),
                    bbox_x=cit_data.get("bbox", {}).get("x"),
                    bbox_y=cit_data.get("bbox", {}).get("y"),
                    bbox_width=cit_data.get("bbox", {}).get("width"),
                    bbox_height=cit_data.get("bbox", {}).get("height")
                )
                db.add(citation)
            
            db.commit()
            
            # Send done event
            yield f"data: {json.dumps({'type': 'done', 'message_id': str(assistant_message.id)})}\n\n"
            
        except Exception as e:
            print(f"Error in ask endpoint: {e}")
            yield f"data: {json.dumps({'type': 'error', 'error': str(e)})}\n\n"
    
    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )

