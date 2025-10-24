import re
from typing import AsyncGenerator, Dict, Any
from sqlalchemy.orm import Session
import uuid

from app.services.vector import vector_service
from app.models.document import Chunk
from openai import AsyncOpenAI
from app.core.config import settings


class QAService:
    def __init__(self):
        self.client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY) if settings.OPENAI_API_KEY else None
    
    async def answer_question(
        self,
        user_id: str,
        document_id: str,
        question: str,
        db: Session
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """Generate an answer with streaming and citations"""
        
        try:
            # 1. Retrieve relevant chunks
            search_results = vector_service.search(
                user_id=user_id,
                doc_id=document_id,
                query=question,
                top_k=8
            )
            
            if not search_results:
                yield {
                    "type": "error",
                    "error": "No relevant content found in the document."
                }
                return
            
            # 2. Get chunk details from database
            chunks = []
            for vector_id, score in search_results:
                chunk = db.query(Chunk).filter(
                    Chunk.document_id == uuid.UUID(document_id),
                    Chunk.vector_id == vector_id
                ).first()
                if chunk:
                    chunks.append({
                        "text": chunk.text,
                        "page_number": chunk.page_number,
                        "char_start": chunk.char_start,
                        "char_end": chunk.char_end,
                        "score": score
                    })
            
            # 3. Build evidence pack
            evidence = self._build_evidence_pack(chunks)
            
            # 4. Create prompt
            system_prompt = """You are a precise academic assistant. Answer questions based ONLY on the provided evidence.

Rules:
1. Keep answers concise (2-6 sentences)
2. EVERY sentence must cite a source as [p. N]
3. If information is not in the evidence, say "Not found in the provided pages."
4. Be accurate and stick to what's explicitly stated

Example: "The elastic modulus measures stiffness [p. 42]. Steel typically has a value of 200 GPa [p. 43]." """
            
            user_prompt = f"""Question: {question}

Evidence:
{evidence}

Provide a concise answer with citations."""
            
            # 5. Stream response from GPT-4o mini
            if not self.client:
                yield {"type": "error", "error": "OpenAI API key not configured"}
                return
            
            stream = await self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.3,
                max_tokens=500,
                stream=True
            )
            
            full_answer = ""
            async for chunk_response in stream:
                if chunk_response.choices[0].delta.content:
                    token = chunk_response.choices[0].delta.content
                    full_answer += token
                    yield {
                        "type": "token",
                        "content": token
                    }
            
            # 6. Extract and emit citations
            citations = self._extract_citations(full_answer, chunks)
            for citation in citations:
                yield {
                    "type": "citation",
                    "citation": citation
                }
        
        except Exception as e:
            print(f"Error in QA service: {e}")
            yield {
                "type": "error",
                "error": str(e)
            }
    
    def _build_evidence_pack(self, chunks: list) -> str:
        """Build evidence text from chunks"""
        evidence_parts = []
        for i, chunk in enumerate(chunks[:6], 1):  # Top 6 chunks
            evidence_parts.append(
                f"[Source {i}, p. {chunk['page_number']}]\n{chunk['text']}\n"
            )
        return "\n".join(evidence_parts)
    
    def _extract_citations(self, answer: str, chunks: list) -> list:
        """Extract citation markers and map to actual chunks"""
        citations = []
        
        # Find all [p. N] patterns
        page_pattern = r'\[p\.\s*(\d+)\]'
        matches = re.finditer(page_pattern, answer)
        
        seen_pages = set()
        for match in matches:
            page_num = int(match.group(1))
            if page_num in seen_pages:
                continue
            seen_pages.add(page_num)
            
            # Find corresponding chunk
            for chunk in chunks:
                if chunk['page_number'] == page_num:
                    citations.append({
                        "page_number": page_num,
                        "char_start": chunk['char_start'],
                        "char_end": chunk['char_end']
                    })
                    break
        
        return citations


qa_service = QAService()

