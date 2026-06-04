FROM python:3.11-slim

WORKDIR /code

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download the sentence-transformers model during the build phase
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('all-MiniLM-L6-v2')"

# Copy the rest of the backend files
COPY . .

# Expose port 7860 (Hugging Face default port)
EXPOSE 7860

# Start command (Hugging Face requires port 7860)
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7860"]
