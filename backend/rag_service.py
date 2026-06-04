import os
import json
import fitz  # PyMuPDF
import logging
from datetime import datetime
from uuid import uuid4
from typing import List, Dict, Any, Optional

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("RAGService")

# Langchain dependencies will be imported lazily within methods to conserve startup memory.

class RAGService:
    def __init__(self, data_dir: str = "backend/data"):
        self.data_dir = data_dir
        # Ensure base data directory exists
        os.makedirs(self.data_dir, exist_ok=True)
        self._embeddings = None

    @property
    def embeddings(self):
        if self._embeddings is None:
            logger.info("Initializing HuggingFaceEmbeddings (all-MiniLM-L6-v2)...")
            from langchain_huggingface import HuggingFaceEmbeddings
            self._embeddings = HuggingFaceEmbeddings(
                model_name="all-MiniLM-L6-v2",
                model_kwargs={'device': 'cpu'}
            )
            logger.info("Embeddings model loaded successfully.")
        return self._embeddings

    # User isolated path helpers
    def get_user_dir(self, user_id: str) -> str:
        path = os.path.join(self.data_dir, "users", user_id)
        os.makedirs(path, exist_ok=True)
        return path

    def get_user_uploads_dir(self, user_id: str) -> str:
        path = os.path.join(self.get_user_dir(user_id), "uploads")
        os.makedirs(path, exist_ok=True)
        return path

    def get_user_indices_dir(self, user_id: str) -> str:
        path = os.path.join(self.get_user_dir(user_id), "indices")
        os.makedirs(path, exist_ok=True)
        return path

    def get_user_db_path(self, user_id: str) -> str:
        return os.path.join(self.get_user_dir(user_id), "documents.json")

    # Document JSON database operations (user isolated)
    def load_db(self, user_id: str) -> Dict[str, Any]:
        db_path = self.get_user_db_path(user_id)
        if not os.path.exists(db_path):
            try:
                with open(db_path, "w") as f:
                    json.dump({}, f)
                return {}
            except Exception as e:
                logger.error(f"Error creating database file for user {user_id}: {e}")
                return {}
        try:
            with open(db_path, "r") as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Error loading database for user {user_id}: {e}")
            return {}

    def save_db(self, user_id: str, db: Dict[str, Any]):
        db_path = self.get_user_db_path(user_id)
        try:
            with open(db_path, "w") as f:
                json.dump(db, f, indent=2)
        except Exception as e:
            logger.error(f"Error saving database for user {user_id}: {e}")

    def get_document(self, user_id: str, doc_id: str) -> Optional[Dict[str, Any]]:
        db = self.load_db(user_id)
        return db.get(doc_id)

    def list_documents(self, user_id: str) -> List[Dict[str, Any]]:
        db = self.load_db(user_id)
        return list(db.values())

    def update_doc_status(self, user_id: str, doc_id: str, status: str, error: str = None, num_chunks: int = 0):
        db = self.load_db(user_id)
        if doc_id in db:
            db[doc_id]["status"] = status
            db[doc_id]["updated_at"] = datetime.utcnow().isoformat()
            if error:
                db[doc_id]["error"] = error
            if num_chunks > 0:
                db[doc_id]["num_chunks"] = num_chunks
            self.save_db(user_id, db)

    def extract_text_and_metadata(self, file_path: str, filename: str) -> List[Dict[str, Any]]:
        chunks = []
        ext = os.path.splitext(filename)[1].lower()

        if ext == ".pdf":
            doc = fitz.open(file_path)
            for page_num in range(len(doc)):
                page = doc.load_page(page_num)
                text = page.get_text()
                if text.strip():
                    chunks.append({
                        "text": text,
                        "metadata": {
                            "source": filename,
                            "page": page_num + 1,
                            "file_ext": ext
                        }
                    })
            doc.close()
        elif ext in [".txt", ".json", ".csv", ".md"]:
            with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                text = f.read()
            if text.strip():
                chunks.append({
                    "text": text,
                    "metadata": {
                        "source": filename,
                        "page": 1,
                        "file_ext": ext
                    }
                })
        else:
            raise ValueError(f"Unsupported file type: {ext}")
            
        return chunks

    def process_and_index_document(self, user_id: str, doc_id: str, file_path: str, filename: str):
        """Extracts, chunks, embeds, and saves to FAISS in user-isolated folder."""
        try:
            self.update_doc_status(user_id, doc_id, "processing")
            
            # Step 1: Extract text and metadata
            raw_docs = self.extract_text_and_metadata(file_path, filename)
            if not raw_docs:
                raise ValueError("No text could be extracted from the document.")

            # Step 2: Split text into small chunks
            from langchain_text_splitters import RecursiveCharacterTextSplitter
            text_splitter = RecursiveCharacterTextSplitter(
                chunk_size=1000,
                chunk_overlap=200,
                length_function=len
            )
            
            final_documents = []
            for doc in raw_docs:
                page_text = doc["text"]
                page_metadata = doc["metadata"]
                
                splits = text_splitter.split_text(page_text)
                for i, split in enumerate(splits):
                    meta = page_metadata.copy()
                    meta["chunk_index"] = i
                    meta["doc_id"] = doc_id
                    
                    from langchain_core.documents import Document
                    final_documents.append(Document(page_content=split, metadata=meta))

            if not final_documents:
                raise ValueError("No chunks were created from the document.")

            # Step 3: Embed chunks and build FAISS vector store
            logger.info(f"Embedding {len(final_documents)} chunks for user {user_id}, doc {doc_id} ({filename})...")
            
            from langchain_community.vectorstores import FAISS
            db = FAISS.from_documents(final_documents, self.embeddings)
            
            # Step 4: Save FAISS index in user's isolated directory
            user_indices_dir = self.get_user_indices_dir(user_id)
            doc_index_path = os.path.join(user_indices_dir, doc_id)
            db.save_local(doc_index_path)
            
            logger.info(f"Successfully saved user FAISS index to {doc_index_path}")
            
            # Step 5: Update database status
            self.update_doc_status(user_id, doc_id, "indexed", num_chunks=len(final_documents))
            
        except Exception as e:
            logger.exception(f"Failed to process document {doc_id} for user {user_id}: {e}")
            self.update_doc_status(user_id, doc_id, "failed", error=str(e))

    def delete_document(self, user_id: str, doc_id: str) -> bool:
        """Deletes a document, its index, and raw files for a specific user ID."""
        db = self.load_db(user_id)
        if doc_id not in db:
            return False
            
        doc_info = db[doc_id]
        
        # Delete index folder in user space
        user_indices_dir = self.get_user_indices_dir(user_id)
        index_path = os.path.join(user_indices_dir, doc_id)
        if os.path.exists(index_path):
            import shutil
            shutil.rmtree(index_path)
            
        # Delete raw file
        file_path = doc_info.get("file_path")
        if file_path and os.path.exists(file_path):
            try:
                os.remove(file_path)
            except Exception as e:
                logger.error(f"Error removing file {file_path}: {e}")
                
        # Remove from db JSON
        del db[doc_id]
        self.save_db(user_id, db)
        return True

    def _get_combined_vector_store(self, user_id: str, doc_ids: Optional[List[str]] = None) -> Optional["FAISS"]:
        """Loads and merges FAISS indexes within the user's isolated directory."""
        from langchain_community.vectorstores import FAISS
        db_meta = self.load_db(user_id)
        active_docs = [
            d_id for d_id, doc in db_meta.items()
            if doc["status"] == "indexed"
        ]
        
        if doc_ids:
            active_docs = [d for d in active_docs if d in doc_ids]
            
        if not active_docs:
            return None
            
        user_indices_dir = self.get_user_indices_dir(user_id)
        
        # Load the first vector store
        first_doc_id = active_docs[0]
        first_path = os.path.join(user_indices_dir, first_doc_id)
        if not os.path.exists(first_path):
            return None
            
        main_vector_store = FAISS.load_local(first_path, self.embeddings, allow_dangerous_deserialization=True)
        
        # Merge the remaining vector stores
        for doc_id in active_docs[1:]:
            path = os.path.join(user_indices_dir, doc_id)
            if os.path.exists(path):
                sub_store = FAISS.load_local(path, self.embeddings, allow_dangerous_deserialization=True)
                main_vector_store.merge_from(sub_store)
                
        return main_vector_store

    def similarity_search(self, user_id: str, query: str, doc_ids: Optional[List[str]] = None, k: int = 5) -> List[Dict[str, Any]]:
        """Performs isolated similarity search across a user's index library."""
        vs = self._get_combined_vector_store(user_id, doc_ids)
        if not vs:
            return []
            
        results = vs.similarity_search_with_relevance_scores(query, k=k)
        
        formatted_results = []
        for doc, score in results:
            formatted_results.append({
                "content": doc.page_content,
                "score": float(score),
                "metadata": doc.metadata
            })
        return formatted_results

    def query_llm_gemini(self, prompt: str, system_prompt: str, api_key: str) -> str:
        import requests
        gemini_model = os.environ.get("GEMINI_MODEL", "gemini-3.5-flash")
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{gemini_model}:generateContent?key={api_key}"
        payload = {
            "contents": [{
                "parts": [{"text": prompt}]
            }],
            "systemInstruction": {
                "parts": [{"text": system_prompt}]
            },
            "generationConfig": {
                "temperature": 0.2
            }
        }
        headers = {
            "Content-Type": "application/json"
        }
        try:
            logger.info(f"Sending request to Gemini API ({gemini_model})...")
            response = requests.post(url, json=payload, headers=headers, timeout=60)
            if response.status_code == 200:
                res_data = response.json()
                candidates = res_data.get("candidates", [])
                if candidates:
                    parts = candidates[0].get("content", {}).get("parts", [])
                    if parts:
                        return parts[0].get("text", "").strip()
                raise Exception(f"Unexpected Gemini API response structure: {res_data}")
            else:
                raise Exception(f"Gemini API returned code {response.status_code}: {response.text}")
        except Exception as e:
            logger.error(f"Gemini API query failed: {e}")
            raise e

    def query_llm_ollama(self, prompt: str, system_prompt: str, ollama_url: str, model_name: str) -> str:
        import requests
        url = f"{ollama_url.rstrip('/')}/api/generate"
        payload = {
            "model": model_name,
            "prompt": prompt,
            "system": system_prompt,
            "stream": False,
            "options": {
                "temperature": 0.2
            }
        }
        try:
            logger.info(f"Connecting to Ollama at {url} using model {model_name}...")
            response = requests.post(
                url, 
                json=payload, 
                headers={
                    "ngrok-skip-browser-warning": "true",
                    "Bypass-Tunnel-Reminder": "true"
                }, 
                timeout=120
            )
            if response.status_code == 200:
                res_data = response.json()
                return res_data.get("response", "").strip()
            else:
                raise Exception(f"Ollama server returned code {response.status_code}: {response.text}")
        except Exception as e:
            logger.warning(f"Ollama connection failed: {e}. Falling back to demo/mock generator.")
            raise e

    def generate_demo_response(self, query: str, context_chunks: List[Dict[str, Any]]) -> str:
        if not context_chunks:
            return "I couldn't find any relevant context in your indexed documents. Please upload files to search."

        response = (
            "### [DEMO MODE: Ollama is offline or not configured]\n\n"
            "This response is generated by extracting relevant sections directly from your documents. "
            "To use full conversational AI, please start Ollama and configure the settings.\n\n"
            "**Key Findings from Documents:**\n\n"
        )
        
        for idx, chunk in enumerate(context_chunks[:3]):
            source = chunk["metadata"].get("source", "Unknown Document")
            page = chunk["metadata"].get("page", 1)
            content = chunk["content"].strip()
            
            lines = [l.strip() for l in content.split("\n") if len(l.strip()) > 10]
            summary_sentences = lines[:2] if lines else [content[:200]]
            summary_text = " ... ".join(summary_sentences)
            
            response += f"- **Excerpt from {source} (Page {page}):**\n"
            response += f"  > \"{summary_text}\" [Source {idx+1}]\n\n"
            
        response += "\n**Synthesis:**\n"
        response += f"Based on semantic similarity, your query regarding *\"{query}\"* matches financial data including "
        sources_list = [f"{c['metadata'].get('source')} (p. {c['metadata'].get('page')})" for c in context_chunks[:3]]
        response += ", ".join(list(set(sources_list))) + "."
        
        return response

    def run_rag_chat(
        self, 
        user_id: str,
        query: str, 
        doc_ids: Optional[List[str]] = None, 
        history: List[Dict[str, str]] = None,
        ollama_url: str = "http://localhost:11434",
        model_name: str = "llama3",
        demo_mode: bool = False
    ) -> Dict[str, Any]:
        """Runs the isolated RAG cycle for a specific user ID."""
        # Retrieve context chunks from user-isolated vector stores
        chunks = self.similarity_search(user_id, query, doc_ids=doc_ids, k=4)
        
        if not chunks:
            return {
                "answer": "No indexed documents were found in your library. Please upload documents and search again.",
                "citations": [],
                "mode": "no_context"
            }
            
        context_str = ""
        citations = []
        for i, chunk in enumerate(chunks):
            citation_id = f"Source {i+1}"
            meta = chunk["metadata"]
            citations.append({
                "id": citation_id,
                "source": meta.get("source", "Unknown Document"),
                "page": meta.get("page", 1),
                "content": chunk["content"]
            })
            
            context_str += f"[{citation_id}] (File: {meta.get('source')}, Page {meta.get('page')}):\n{chunk['content']}\n\n"

        system_prompt = (
            "You are a helpful, professional Enterprise Financial RAG Assistant. "
            "Answer the query based strictly on the provided context sections. "
            "For each claim or piece of information you retrieve, you MUST cite the source using brackets like [Source 1], [Source 2], etc. "
            "If the context does not contain enough information to answer, state clearly that you cannot find the answer in the provided documents. "
            "Maintain an objective, professional, financial analyst tone."
        )
        
        history_str = ""
        if history:
            history_str = "Conversation History:\n"
            for msg in history[-5:]:
                role = msg.get("role", "user")
                content = msg.get("content", "")
                history_str += f"{role.capitalize()}: {content}\n"
            history_str += "\n"
            
        prompt = (
            f"{history_str}"
            f"Context:\n{context_str}\n"
            f"Query: {query}\n\n"
            f"Provide a detailed answer with inline citations (e.g. [Source 1]):"
        )
        
        mode = "ollama"
        gemini_api_key = os.environ.get("GEMINI_API_KEY")
        
        if demo_mode:
            logger.info("Demo mode is forced. Generating simulated response.")
            answer = self.generate_demo_response(query, chunks)
            mode = "demo"
        elif gemini_api_key:
            try:
                gemini_model = os.environ.get("GEMINI_MODEL", "gemini-3.5-flash")
                logger.info(f"GEMINI_API_KEY detected. Directing inference to Gemini API ({gemini_model})...")
                answer = self.query_llm_gemini(prompt, system_prompt, gemini_api_key)
                mode = "gemini"
            except Exception as e:
                logger.warning(f"Gemini API query failed: {e}. Falling back to demo mode.")
                answer = self.generate_demo_response(query, chunks)
                mode = "demo_fallback"
        else:
            try:
                answer = self.query_llm_ollama(prompt, system_prompt, ollama_url, model_name)
            except Exception as e:
                logger.warning("Ollama query failed. Falling back to demo mode.")
                answer = self.generate_demo_response(query, chunks)
                mode = "demo_fallback"
                
        return {
            "answer": answer,
            "citations": citations,
            "mode": mode
        }
