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
# Local dev: use ai-service/.env when present. CI (Jenkins, etc.) typically has no committed .env —
# rely on process environment and the defaults below.
if _env_path.is_file():
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
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3:8b")
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_EMBED_MODEL = os.getenv("OLLAMA_EMBED_MODEL", "nomic-embed-text")
OLLAMA_FAST_MODEL = os.getenv("OLLAMA_FAST_MODEL", "")

# Level-test / MCQ generation (single-model strategy).
OLLAMA_LEVEL_TEST_MODEL = os.getenv("OLLAMA_LEVEL_TEST_MODEL", "llama3.2:3b")

def _int_env(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, str(default)).strip())
    except (TypeError, ValueError):
        return default

OLLAMA_LEVEL_TEST_NUM_CTX = _int_env("OLLAMA_LEVEL_TEST_NUM_CTX", 3072)
OLLAMA_LEVEL_TEST_NUM_PREDICT = _int_env("OLLAMA_LEVEL_TEST_NUM_PREDICT", 512)
OLLAMA_LEVEL_TEST_TEMPERATURE = float(os.getenv("OLLAMA_LEVEL_TEST_TEMPERATURE", "0.7").strip() or "0.7")
OLLAMA_REPEAT_PENALTY = float(os.getenv("OLLAMA_REPEAT_PENALTY", "1.2").strip() or "1.2")
LEVEL_TEST_MAX_GENERATION_SECONDS = _int_env("LEVEL_TEST_MAX_GENERATION_SECONDS", 300)
LEVEL_TEST_GENERATION_TIMEOUT = _int_env("LEVEL_TEST_GENERATION_TIMEOUT", LEVEL_TEST_MAX_GENERATION_SECONDS)
LEVEL_TEST_SECONDS_PER_QUESTION = _int_env("LEVEL_TEST_SECONDS_PER_QUESTION", 25)
LEVEL_TEST_RETRIES_PER_TOPIC = _int_env("LEVEL_TEST_RETRIES_PER_TOPIC", 2)

# Generic aliases used by some generation callers.
OLLAMA_NUM_CTX = _int_env("OLLAMA_NUM_CTX", 3072)
OLLAMA_NUM_PREDICT = _int_env("OLLAMA_NUM_PREDICT", 512)
OLLAMA_TEMPERATURE = float(os.getenv("OLLAMA_TEMPERATURE", str(OLLAMA_LEVEL_TEST_TEMPERATURE)).strip() or str(OLLAMA_LEVEL_TEST_TEMPERATURE))

# Video Generation (D-ID)
DID_API_KEY = os.getenv("DID_API_KEY", "").strip()
DID_BASE_URL = os.getenv("DID_BASE_URL", "https://api.d-id.com").strip()

# Redis (optional, used for API response caching in production)
REDIS_URL = os.getenv("REDIS_URL", "")
REDIS_CACHE_PREFIX = os.getenv("REDIS_CACHE_PREFIX", "startsmart:resp")

# JWT Security
JWT_SECRET = os.getenv("JWT_SECRET", "your-secret-key-here")

# Config as dictionary for easy access
config = {
    "MONGODB_URI": MONGODB_URI,
    "MONGODB_DB_NAME": MONGODB_DB_NAME,
    "CHROMA_PERSIST_DIRECTORY": CHROMA_PERSIST_DIRECTORY,
    "OLLAMA_MODEL": OLLAMA_MODEL,
    "OLLAMA_BASE_URL": OLLAMA_BASE_URL,
    "OLLAMA_EMBED_MODEL": OLLAMA_EMBED_MODEL,
    "OLLAMA_FAST_MODEL": OLLAMA_FAST_MODEL,
    "OLLAMA_LEVEL_TEST_MODEL": OLLAMA_LEVEL_TEST_MODEL,
    "OLLAMA_LEVEL_TEST_NUM_CTX": str(OLLAMA_LEVEL_TEST_NUM_CTX),
    "OLLAMA_LEVEL_TEST_NUM_PREDICT": str(OLLAMA_LEVEL_TEST_NUM_PREDICT),
    "OLLAMA_LEVEL_TEST_TEMPERATURE": str(OLLAMA_LEVEL_TEST_TEMPERATURE),
    "OLLAMA_REPEAT_PENALTY": str(OLLAMA_REPEAT_PENALTY),
    "OLLAMA_NUM_CTX": str(OLLAMA_NUM_CTX),
    "OLLAMA_NUM_PREDICT": str(OLLAMA_NUM_PREDICT),
    "OLLAMA_TEMPERATURE": str(OLLAMA_TEMPERATURE),
    "LEVEL_TEST_MAX_GENERATION_SECONDS": str(LEVEL_TEST_MAX_GENERATION_SECONDS),
    "LEVEL_TEST_GENERATION_TIMEOUT": str(LEVEL_TEST_GENERATION_TIMEOUT),
    "LEVEL_TEST_SECONDS_PER_QUESTION": str(LEVEL_TEST_SECONDS_PER_QUESTION),
    "LEVEL_TEST_RETRIES_PER_TOPIC": str(LEVEL_TEST_RETRIES_PER_TOPIC),
    "REDIS_URL": REDIS_URL,
    "REDIS_CACHE_PREFIX": REDIS_CACHE_PREFIX,
    "DID_API_KEY": DID_API_KEY,
    "JWT_SECRET": JWT_SECRET,
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


# Print loaded config (without sensitive data) when module is imported (skip in CI to reduce noise)
if __name__ != "__main__" and not os.getenv("CI"):
    print("[config] Loaded configuration:")
    print(f"  MONGODB_URI: {_mask_uri(MONGODB_URI)}")
    print(f"  MONGODB_DB_NAME: {MONGODB_DB_NAME}")
    print(f"  CHROMA_PERSIST_DIRECTORY: {CHROMA_PERSIST_DIRECTORY}")
    print(f"  OLLAMA_MODEL: {OLLAMA_MODEL}")
    print(f"  OLLAMA_FAST_MODEL: {OLLAMA_FAST_MODEL or '(not set, using OLLAMA_MODEL)'}")
    print(f"  OLLAMA_LEVEL_TEST_MODEL: {OLLAMA_LEVEL_TEST_MODEL}")
    print(f"  OLLAMA_LEVEL_TEST_NUM_CTX: {OLLAMA_LEVEL_TEST_NUM_CTX}")
    print(f"  OLLAMA_LEVEL_TEST_NUM_PREDICT: {OLLAMA_LEVEL_TEST_NUM_PREDICT}")
    print(f"  OLLAMA_LEVEL_TEST_TEMPERATURE: {OLLAMA_LEVEL_TEST_TEMPERATURE}")
    print(f"  OLLAMA_REPEAT_PENALTY: {OLLAMA_REPEAT_PENALTY}")
    print(f"  OLLAMA_NUM_CTX: {OLLAMA_NUM_CTX}")
    print(f"  OLLAMA_NUM_PREDICT: {OLLAMA_NUM_PREDICT}")
    print(f"  OLLAMA_TEMPERATURE: {OLLAMA_TEMPERATURE}")
    print(f"  LEVEL_TEST_MAX_GENERATION_SECONDS: {LEVEL_TEST_MAX_GENERATION_SECONDS}")
    print(f"  LEVEL_TEST_GENERATION_TIMEOUT: {LEVEL_TEST_GENERATION_TIMEOUT}")
    print(f"  LEVEL_TEST_SECONDS_PER_QUESTION: {LEVEL_TEST_SECONDS_PER_QUESTION}")
    print(f"  LEVEL_TEST_RETRIES_PER_TOPIC: {LEVEL_TEST_RETRIES_PER_TOPIC}")
    print(f"  OLLAMA_EMBED_MODEL: {OLLAMA_EMBED_MODEL}")
    print(f"  OLLAMA_BASE_URL: {OLLAMA_BASE_URL}")
    print(f"  REDIS_URL: {'(set)' if REDIS_URL else '(not set)'}")
    print(f"  REDIS_CACHE_PREFIX: {REDIS_CACHE_PREFIX}")
    print(f"  DID_API_KEY: {'(set)' if DID_API_KEY else '(not set)'}")
