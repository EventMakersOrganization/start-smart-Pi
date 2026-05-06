# FastAPI ai-service — matches Jenkinsfile.ai-cd image startsmart-ai
FROM python:3.12-slim-bookworm

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy only application source — sensitive files excluded via .dockerignore
COPY api.py .
COPY core/ core/
COPY rag/ rag/
COPY video/ video/
COPY embeddings/ embeddings/
COPY generation/ generation/
COPY search/ search/
COPY optimization/ optimization/
COPY level_test/ level_test/
COPY learning_state/ learning_state/
COPY adaptive/ adaptive/
COPY recommendation/ recommendation/
COPY analytics/ analytics/
COPY quality/ quality/
COPY utils/ utils/

RUN addgroup --system appgroup && adduser --system --ingroup appgroup appuser \
    && chown -R appuser:appgroup /app
USER appuser

ENV PYTHONUNBUFFERED=1
EXPOSE 8000

CMD ["uvicorn", "api:app", "--host", "0.0.0.0", "--port", "8000"]
