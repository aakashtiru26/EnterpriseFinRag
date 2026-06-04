# Enterprise Financial RAG Assistant (FidelityRAG) - Deployment Guide

This guide describes how to deploy the **Next.js Frontend** and the **FastAPI Backend** to production using free-tier cloud platforms.

---

## Architecture Overview
The application consists of:
1. **Next.js Frontend**: Deployed to **Vercel** (Free Hobby Tier). Communicates with the backend API via HTTPS.
2. **FastAPI Backend**: Deployed as a web service container (to **Render** or **Hugging Face Spaces**). Handles:
   - File uploads and parsing (PDF/TXT).
   - Document chunking and embedding generation (local CPU sentence-transformers).
   - Vector database storage (FAISS indexes saved per user).
   - LLM generation (connects to local/remote Ollama or falls back to rule-based excerpt synthesis).

---

## 1. Preparing the Codebase (Pushing to GitHub)
Make sure your codebase is pushed to your private or public GitHub repository.

1. Initialize git if not already done:
   ```bash
   git init
   ```
2. Add files and commit:
   ```bash
   git add .
   git commit -m "Initialize secure multi-user Enterprise Financial RAG Assistant"
   ```
3. Link your repository and push to the main branch:
   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
   git branch -M main
   git push -u origin main
   ```

---

## 2. Deploying the Backend (Python + FastAPI)
Since the backend uses `sentence-transformers` and `faiss-cpu`, it runs locally on standard CPU environments without requiring expensive GPUs.

### Option A: Render (Free Web Service)
Render is a cloud hosting provider that supports Python applications.

1. **Create Render Account**: Sign up at [render.com](https://render.com).
2. **New Web Service**: Click **New +** and select **Web Service**. Connect your GitHub repository.
3. **Configure Service Details**:
   - **Name**: `fidelity-rag-api`
   - **Root Directory**: `backend`
   - **Runtime**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
4. **Configure Environment Variables**:
   Under the **Environment** tab, add:
   - `PYTHON_VERSION`: `3.11.0` (or similar)
   - `FIREBASE_PROJECT_ID`: Your actual Firebase project ID (enables ID token verification checks).
   - `GEMINI_API_KEY`: Your Google Gemini API Key. *(Optional. If configured, the backend automatically uses Gemini 3.5 Flash for cloud conversations, removing the need for local Ollama servers or Ngrok tunnels).*
   - `GEMINI_MODEL`: *(Optional)* The model ID to use (e.g. `gemini-3.5-flash`). Defaults to `gemini-3.5-flash`.
5. **Note on State Persistence**:
   - Render's **Free Tier** does not include persistent disk storage. When the Render service restarts (e.g., after being inactive/sleeping or on redeployment), any uploaded PDFs and local FAISS vector indices will be deleted.
   - For a production deployment with persistent files, add a **Render Disk** mount (requires Render's paid individual instance tier, starting at $5/month) mounted at `/Users/aakashtiru/Desktop/Resume-Projects/fra/backend/backend/data` (which is where uploaded documents are saved).
   - Alternatively, you can configure a cloud storage fallback (e.g., AWS S3 or Supabase Storage) in `rag_service.py` to upload/download indexes dynamically.

### Option B: Hugging Face Spaces (Free CPU Docker Space)
Hugging Face Spaces provides a free CPU Docker container environment, which works exceptionally well for Python RAG servers.

1. Create a Space on Hugging Face: Select **Docker** space, choosing blank or FastAPI template.
2. Clone your Space repo, place the contents of `backend/` there (including a custom `Dockerfile` pointing to `main.py`).
3. Set your environment variables in the Hugging Face Space settings.
4. *Bonus*: It will run 24/7 without sleeping if configured correctly!

---

## 3. Deploying the Frontend (Next.js)
Vercel is the optimal hosting platform for Next.js applications.

1. **Create Vercel Account**: Sign up at [vercel.com](https://vercel.com).
2. **Import Project**: Select **Add New** > **Project** and select your GitHub repository.
3. **Configure Build Settings**:
   - **Framework Preset**: `Next.js`
   - **Root Directory**: `frontend`
   - **Build Command**: `next build`
   - **Output Directory**: `.next`
4. **Environment Variables**:
   Under project settings, add the Firebase Client credentials and the URL of the deployed FastAPI backend:
   - `NEXT_PUBLIC_API_URL`: The URL of your deployed Render backend (e.g. `https://fidelity-rag-api.onrender.com`).
   - `NEXT_PUBLIC_FIREBASE_API_KEY`: Your Firebase project Web API Key.
   - `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`: `your-app.firebaseapp.com`
   - `NEXT_PUBLIC_FIREBASE_PROJECT_ID`: `your-app-id`
   - `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`: `your-app.appspot.com`
   - `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`: `your-sender-id`
   - `NEXT_PUBLIC_FIREBASE_APP_ID`: `your-app-id`
5. **Deploy**: Click **Deploy**. Vercel will build the frontend and provide you with a production URL (e.g. `https://fidelity-rag.vercel.app`).

---

## 4. Local-First Conversational AI (Ollama)
Because the RAG inference (Ollama) runs locally, a cloud-hosted backend will attempt to fetch `http://localhost:11434` from the user's local machine or the server host.
- **Demo Mode Fallback**: If Ollama is offline or unreachable on the cloud backend, the system will automatically fall back to **Demo Sandbox Mode**, extracting relevant text chunks and rendering cited findings directly on the client console.
- **Exposing Local Ollama via Tunneling (Optional)**: If you wish to connect your cloud-deployed backend to your local Ollama engine, you can run a secure tunnel like Ngrok on your local machine:
  ```bash
  ngrok http 11434
  ```
  Then, in the **Settings Console** page of the deployed frontend, update the **Ollama API Base URL** to your public Ngrok URL (e.g., `https://xxxx.ngrok-free.app`).
