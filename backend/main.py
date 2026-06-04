import os
import shutil
import logging
from uuid import uuid4
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel
from fastapi import FastAPI, UploadFile, File, BackgroundTasks, HTTPException, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
import requests

from rag_service import RAGService
from auth_helper import get_current_user, verify_firebase_token, security_bearer

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("main")

# Create FastAPI app
app = FastAPI(title="Enterprise Financial RAG Assistant API")

# Add CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins for local dev
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize RAG Service
DATA_DIR = "backend/data"
rag_service = RAGService(data_dir=DATA_DIR)

# Request Models
class SearchRequest(BaseModel):
    query: str
    doc_ids: Optional[List[str]] = None
    k: int = 5

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    query: str
    doc_ids: Optional[List[str]] = None
    history: Optional[List[ChatMessage]] = None
    ollama_url: Optional[str] = "http://localhost:11434"
    model_name: Optional[str] = "llama3"
    demo_mode: Optional[bool] = False

# Endpoints
@app.get("/")
async def root():
    return {"message": "Enterprise Financial RAG Assistant API is online", "docs": "/docs"}

@app.get("/api/health")
async def health_check(request: Request, ollama_url: Optional[str] = None):
    """Health check endpoint. Supports optional auth for user statistics."""
    ollama_status = "offline"
    ollama_models = []
    
    # Try custom or default Ollama url
    target_ollama_url = ollama_url or "http://localhost:11434"
    try:
        response = requests.get(
            f"{target_ollama_url.rstrip('/')}/api/tags", 
            headers={
                "ngrok-skip-browser-warning": "true",
                "Bypass-Tunnel-Reminder": "true"
            }, 
            timeout=3
        )
        if response.status_code == 200:
            ollama_status = "online"
            ollama_models = [m.get("name") for m in response.json().get("models", [])]
    except Exception as e:
        logger.warning(f"Ollama health check failed for {target_ollama_url}: {e}")
        
    # Check Gemini API availability
    gemini_status = "offline"
    if os.environ.get("GEMINI_API_KEY"):
        gemini_status = "online"
        
    # Optional Auth stats check
    total_docs = 0
    indexed_count = 0
    processing_count = 0
    
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        try:
            token = auth_header.split("Bearer ")[1]
            user_payload = verify_firebase_token(token)
            user_id = user_payload.get("uid")
            
            if user_id:
                db = rag_service.load_db(user_id)
                total_docs = len(db)
                indexed_count = sum(1 for doc in db.values() if doc["status"] == "indexed")
                processing_count = sum(1 for doc in db.values() if doc["status"] == "processing")
        except Exception:
            # Skip stats aggregation if token check bails out
            pass
            
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "ollama": {
            "status": ollama_status,
            "models": ollama_models,
            "url": target_ollama_url
        },
        "gemini": {
            "status": gemini_status,
            "model": os.environ.get("GEMINI_MODEL", "gemini-3.5-flash")
        },
        "stats": {
            "total_documents": total_docs,
            "indexed_documents": indexed_count,
            "processing_documents": processing_count
        }
    }

@app.get("/api/documents")
async def get_documents(current_user: dict = Depends(get_current_user)):
    """Lists all uploaded documents for the authenticated user."""
    user_id = current_user["uid"]
    return rag_service.list_documents(user_id)

@app.post("/api/upload")
async def upload_document(
    background_tasks: BackgroundTasks, 
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """Uploads a PDF or TXT file and indexes it in user isolated folders."""
    user_id = current_user["uid"]
    filename = file.filename
    ext = os.path.splitext(filename)[1].lower()
    
    if ext not in [".pdf", ".txt", ".csv", ".json", ".md"]:
        raise HTTPException(
            status_code=400, 
            detail=f"Unsupported file format '{ext}'. Only PDF and text files are supported."
        )
        
    doc_id = str(uuid4())
    user_uploads_dir = rag_service.get_user_uploads_dir(user_id)
    upload_path = os.path.join(user_uploads_dir, f"{doc_id}{ext}")
    
    # Save file to user uploads folder
    try:
        with open(upload_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save uploaded file: {str(e)}")
        
    size_bytes = os.path.getsize(upload_path)
    
    # Register document in user isolated database
    db = rag_service.load_db(user_id)
    doc_entry = {
        "id": doc_id,
        "filename": filename,
        "file_path": upload_path,
        "size_bytes": size_bytes,
        "status": "queued",
        "num_chunks": 0,
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat(),
        "error": None
    }
    db[doc_id] = doc_entry
    rag_service.save_db(user_id, db)
    
    # Trigger background indexing
    background_tasks.add_task(
        rag_service.process_and_index_document, 
        user_id,
        doc_id, 
        upload_path, 
        filename
    )
    
    return doc_entry

@app.delete("/api/documents/{doc_id}")
async def delete_document(doc_id: str, current_user: dict = Depends(get_current_user)):
    """Deletes a document from the system and user index."""
    user_id = current_user["uid"]
    deleted = rag_service.delete_document(user_id, doc_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Document not found")
    return {"message": "Document deleted successfully", "id": doc_id}

@app.post("/api/search")
async def search_documents(request: SearchRequest, current_user: dict = Depends(get_current_user)):
    """Performs semantic search across the user isolated vector store."""
    user_id = current_user["uid"]
    try:
        results = rag_service.similarity_search(
            user_id=user_id,
            query=request.query, 
            doc_ids=request.doc_ids, 
            k=request.k
        )
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Similarity search error: {str(e)}")

@app.post("/api/chat")
async def chat_documents(request: ChatRequest, current_user: dict = Depends(get_current_user)):
    """Converses with user isolated documents using RAG."""
    user_id = current_user["uid"]
    try:
        history = []
        if request.history:
            history = [{"role": msg.role, "content": msg.content} for msg in request.history]
            
        result = rag_service.run_rag_chat(
            user_id=user_id,
            query=request.query,
            doc_ids=request.doc_ids,
            history=history,
            ollama_url=request.ollama_url,
            model_name=request.model_name,
            demo_mode=request.demo_mode
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"RAG chat processing error: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    # Load dotenv if running directly
    from dotenv import load_dotenv
    load_dotenv()
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
