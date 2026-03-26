"""
Configuration module - loads environment variables from .env and exports config.
"""
import os
from pathlib import Path

try:
    from dotenv import load_dotenv
except ImportError:
    raise ImportError("python-dotenv is required. Install with: pip install python-dotenv")

# Resolve .env path: ai-service root (parent of core/)
_SERVICE_ROOT = Path(__file__).resolve().parent.parent
_env_path = _SERVICE_ROOT / ".env"
if not _env_path.exists():
    raise FileNotFoundError(
        f".env file not found at {_env_path}. "
        "Please create a .env file with required variables (MONGODB_URI, etc.)."
    )

load_dotenv(_env_path)

# MongoDB
MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
MONGODB_DB_NAME = os.getenv("MONGODB_DB_NAME")
if not MONGODB_DB_NAME and MONGODB_URI:
    # Extract database name from URI (e.g. mongodb://host:27017/dbname -> dbname)
    try:
        path = MONGODB_URI.rstrip("/").split("/")[-1]
        if path and "?" not in path:
            MONGODB_DB_NAME = path
    except Exception:
        pass
if not MONGODB_DB_NAME:
    MONGODB_DB_NAME = "adaptive-learning"

# ChromaDB
CHROMA_PERSIST_DIRECTORY = os.getenv("CHROMA_PERSIST_DIRECTORY", "./chroma_db")

# Ollama
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "mistral")
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_EMBED_MODEL = os.getenv("OLLAMA_EMBED_MODEL", "nomic-embed-text")
OLLAMA_FAST_MODEL = os.getenv("OLLAMA_FAST_MODEL", "")

# Config as dictionary for easy access
config = {
    "MONGODB_URI": MONGODB_URI,
    "MONGODB_DB_NAME": MONGODB_DB_NAME,
    "CHROMA_PERSIST_DIRECTORY": CHROMA_PERSIST_DIRECTORY,
    "OLLAMA_MODEL": OLLAMA_MODEL,
    "OLLAMA_BASE_URL": OLLAMA_BASE_URL,
    "OLLAMA_EMBED_MODEL": OLLAMA_EMBED_MODEL,
    "OLLAMA_FAST_MODEL": OLLAMA_FAST_MODEL,
}


def _mask_uri(uri: str) -> str:
    """Mask sensitive parts of MongoDB URI for safe printing."""
    if not uri:
        return "<not set>"
    try:
        # Show scheme and host only, e.g. mongodb://localhost:27017
        parts = uri.split("/")
        if len(parts) >= 3:
            return parts[0] + "//" + parts[2].split("@")[-1].split("/")[0] + "/***"
        return "***"
    except Exception:
        return "***"


# Print loaded config (without sensitive data) when module is imported
if __name__ != "__main__":
    print("[config] Loaded configuration:")
    print(f"  MONGODB_URI: {_mask_uri(MONGODB_URI)}")
    print(f"  MONGODB_DB_NAME: {MONGODB_DB_NAME}")
    print(f"  CHROMA_PERSIST_DIRECTORY: {CHROMA_PERSIST_DIRECTORY}")
    print(f"  OLLAMA_MODEL: {OLLAMA_MODEL}")
    print(f"  OLLAMA_FAST_MODEL: {OLLAMA_FAST_MODEL or '(not set, using OLLAMA_MODEL)'}")
    print(f"  OLLAMA_EMBED_MODEL: {OLLAMA_EMBED_MODEL}")
    print(f"  OLLAMA_BASE_URL: {OLLAMA_BASE_URL}")
