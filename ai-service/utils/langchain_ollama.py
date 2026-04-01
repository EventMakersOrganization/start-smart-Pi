"""
LangChain Ollama LLM wrapper - initialization, testing, and response generation.

Two LLM instances:
  * **default** — ``OLLAMA_MODEL`` (mistral) for chatbot, explanations, etc.
  * **fast**    — ``OLLAMA_FAST_MODEL`` (qwen2.5:3b) for bulk question generation.
                  Falls back to the default model if the fast model isn't pulled yet.

Teaching/chat uses ``num_predict`` (Ollama max output tokens) of 1500 so answers are not truncated.
"""
import logging

from core import config

logger = logging.getLogger(__name__)

# Ollama default is often 128; tutor answers need room for Concept + Explanation + Example + Exercise.
EXPLAIN_NUM_PREDICT_DEFAULT = 1500
# RAG tutor prompt = long SYSTEM + CONTEXT; 4096 was too small and truncated or stressed the model.
EXPLAIN_NUM_CTX = 16384

try:
    from langchain_community.llms import Ollama
except ImportError:
    Ollama = None

DEFAULT_TIMEOUT = 60

_llm_instance = None
_explain_llm_instance = None
_fast_llm_instance = None
_fast_model_checked = False
_model_instances = {}
# After Ollama 500 / runner crash on OLLAMA_LEVEL_TEST_MODEL, skip it and use OLLAMA_MODEL for remaining calls.
_level_test_primary_failed: bool = False


def get_ollama_llm():
    """Main LLM instance (mistral) for chatbot / explanations."""
    global _llm_instance
    if Ollama is None:
        raise ImportError("langchain_community is required. Install with: pip install langchain-community")
    if _llm_instance is None:
        _llm_instance = Ollama(
            model=config.OLLAMA_MODEL,
            base_url=config.OLLAMA_BASE_URL,
            temperature=0.3,
            num_ctx=4096,
        )
        print(f"[langchain_ollama] LLM initialized: model={config.OLLAMA_MODEL}, base_url={config.OLLAMA_BASE_URL}")
    return _llm_instance


def get_ollama_llm_explain():
    """
    Chatbot / teaching explanations: higher temperature for clearer, varied phrasing.
    Does not affect fast bulk generation.
    """
    global _explain_llm_instance
    if Ollama is None:
        raise ImportError("langchain_community is required. Install with: pip install langchain-community")
    if _explain_llm_instance is None:
        _explain_llm_instance = Ollama(
            model=config.OLLAMA_MODEL,
            base_url=config.OLLAMA_BASE_URL,
            temperature=0.7,
            num_ctx=EXPLAIN_NUM_CTX,
            num_predict=EXPLAIN_NUM_PREDICT_DEFAULT,
        )
        print(
            f"[langchain_ollama] Explain LLM initialized: model={config.OLLAMA_MODEL}, "
            f"temperature=0.7, num_ctx={EXPLAIN_NUM_CTX}, num_predict={EXPLAIN_NUM_PREDICT_DEFAULT}, "
            f"base_url={config.OLLAMA_BASE_URL}"
        )
    return _explain_llm_instance


def _is_model_available(model_name: str) -> bool:
    """Check if a model is pulled locally in Ollama."""
    try:
        import ollama as _ollama
        resp = _ollama.list()
        model_list = getattr(resp, "models", None) or (resp if isinstance(resp, list) else [])
        target = model_name.split(":")[0].lower()
        for m in model_list:
            name = getattr(m, "model", "") if not isinstance(m, dict) else m.get("model", m.get("name", ""))
            if target in name.lower():
                return True
        return False
    except Exception:
        return False


def get_fast_llm():
    """
    Fast LLM for bulk structured generation (question batches).
    Uses OLLAMA_FAST_MODEL if available, otherwise falls back to default.
    Low temperature + small num_ctx for speed.
    """
    global _fast_llm_instance, _fast_model_checked
    if Ollama is None:
        raise ImportError("langchain_community is required")

    if _fast_llm_instance is not None:
        return _fast_llm_instance

    fast_model = config.OLLAMA_FAST_MODEL
    if fast_model and not _fast_model_checked:
        _fast_model_checked = True
        if not _is_model_available(fast_model):
            print(f"[langchain_ollama] Fast model '{fast_model}' not available, falling back to '{config.OLLAMA_MODEL}'")
            fast_model = ""

    model = fast_model or config.OLLAMA_MODEL
    _fast_llm_instance = Ollama(
        model=model,
        base_url=config.OLLAMA_BASE_URL,
        temperature=0.1,
        num_ctx=2048,
        num_predict=1024,
    )
    print(f"[langchain_ollama] Fast LLM initialized: model={model}")
    return _fast_llm_instance


def test_ollama_connection():
    """
    Sends a simple test prompt to the LLM and prints prompt and response.
    Returns True if successful, False otherwise.
    Handles case where Ollama is not running.
    """
    test_prompt = "Say hello in one sentence"
    print("[langchain_ollama] test_ollama_connection: starting...")
    print(f"[langchain_ollama] Prompt: {test_prompt}")
    try:
        if Ollama is None:
            print("[langchain_ollama] Error: langchain_community not installed.")
            return False
        llm = get_ollama_llm()
        response = llm.invoke(test_prompt)
        text = response if isinstance(response, str) else getattr(response, "content", str(response))
        print(f"[langchain_ollama] Response: {text}")
        print("[langchain_ollama] test_ollama_connection: Success.")
        return True
    except Exception as e:
        print(f"[langchain_ollama] test_ollama_connection failed: {e}")
        print("[langchain_ollama] Check that Ollama is running (e.g. ollama serve) and the model is pulled.")
        return False


def _make_explain_llm(num_predict: int):
    """One-off explain LLM when a different num_predict (max output tokens) is required."""
    if Ollama is None:
        raise ImportError("langchain_community is required.")
    return Ollama(
        model=config.OLLAMA_MODEL,
        base_url=config.OLLAMA_BASE_URL,
        temperature=0.7,
        num_ctx=EXPLAIN_NUM_CTX,
        num_predict=max(800, int(num_predict)),
    )


def generate_response_explain(prompt, timeout=DEFAULT_TIMEOUT, num_predict: int | None = None):
    """
    Generate chatbot teaching answers with temperature 0.7 (explanations only).
    Logs the full prompt before the request and the raw LLM output before any trimming/formatting.
    """
    if not prompt or not str(prompt).strip():
        print("[langchain_ollama] generate_response_explain: empty prompt.")
        return ""
    try:
        if Ollama is None:
            print("[langchain_ollama] Error: langchain_community not installed.")
            return ""
        full_prompt = str(prompt)
        logger.info("FULL LLM PROMPT (explain):\n%s", full_prompt)
        if num_predict is not None:
            llm = _make_explain_llm(num_predict)
        else:
            llm = get_ollama_llm_explain()
        response = llm.invoke(full_prompt)
        raw = response if isinstance(response, str) else getattr(response, "content", str(response))
        logger.info("RAW LLM RESPONSE: %s", raw)
        text = raw.strip()
        return text
    except Exception as e:
        print(f"[langchain_ollama] generate_response_explain error: {e}")
        return ""


def generate_response(prompt, timeout=DEFAULT_TIMEOUT):
    """
    Generates a response from the Ollama LLM for the given prompt.
    Returns the response text.
    Includes error handling and timeout handling.
    """
    if not prompt or not str(prompt).strip():
        print("[langchain_ollama] generate_response: empty prompt.")
        return ""
    try:
        if Ollama is None:
            print("[langchain_ollama] Error: langchain_community not installed.")
            return ""
        llm = get_ollama_llm()
        response = llm.invoke(prompt)
        text = response if isinstance(response, str) else getattr(response, "content", str(response))
        return text.strip()
    except Exception as e:
        print(f"[langchain_ollama] generate_response error: {e}")
        return ""


def generate_fast(prompt: str) -> str:
    """Generate using the fast model — for bulk structured tasks."""
    if not prompt or not str(prompt).strip():
        return ""
    try:
        if Ollama is None:
            return ""
        llm = get_fast_llm()
        response = llm.invoke(prompt)
        text = response if isinstance(response, str) else getattr(response, "content", str(response))
        return text.strip()
    except Exception as e:
        print(f"[langchain_ollama] generate_fast error: {e}")
        return ""


def _get_llm_for_model(model_name: str):
    """Create/reuse an LLM client bound to a specific Ollama model."""
    global _model_instances
    if Ollama is None:
        raise ImportError("langchain_community is required")
    key = (model_name or "").strip()
    if not key:
        return get_ollama_llm()
    if key not in _model_instances:
        kl = key.lower()
        lt = (getattr(config, "OLLAMA_LEVEL_TEST_MODEL", "") or "").strip()
        fb = (getattr(config, "OLLAMA_LEVEL_TEST_MODEL_FALLBACK", "") or "").strip()
        # Level-test primary/fallback + large code models: use env-tuned limits (4GB VRAM safe)
        if lt and key == lt:
            num_ctx = getattr(config, "OLLAMA_LEVEL_TEST_NUM_CTX", 2048)
            num_predict = getattr(config, "OLLAMA_LEVEL_TEST_NUM_PREDICT", 1024)
        elif fb and key == fb:
            num_ctx = getattr(config, "OLLAMA_LEVEL_TEST_NUM_CTX", 2048)
            num_predict = getattr(config, "OLLAMA_LEVEL_TEST_NUM_PREDICT", 1024)
        elif "deepseek" in kl or "coder-v2" in kl:
            num_ctx = getattr(config, "OLLAMA_LEVEL_TEST_NUM_CTX", 2048)
            num_predict = getattr(config, "OLLAMA_LEVEL_TEST_NUM_PREDICT", 1024)
        else:
            num_ctx = 4096
            num_predict = 1200
        _model_instances[key] = Ollama(
            model=key,
            base_url=config.OLLAMA_BASE_URL,
            temperature=0.25,
            num_ctx=num_ctx,
            num_predict=num_predict,
        )
        print(
            f"[langchain_ollama] Model LLM initialized: model={key}, num_ctx={num_ctx}, num_predict={num_predict}"
        )
    return _model_instances[key]


def generate_with_model(prompt: str, model_name: str) -> str:
    """Generate response using an explicit model name."""
    if not prompt or not str(prompt).strip():
        return ""
    global _level_test_primary_failed, _model_instances
    lt = (getattr(config, "OLLAMA_LEVEL_TEST_MODEL", "") or "").strip()
    mn = (model_name or "").strip()
    # Avoid repeated 500s: once level-test primary crashes, use default model for this process
    if lt and _level_test_primary_failed and mn == lt:
        print(
            "[langchain_ollama] Level-test model skipped (previous failure); "
            f"using OLLAMA_MODEL={config.OLLAMA_MODEL}."
        )
        return generate_response(prompt)
    try:
        if Ollama is None:
            return ""
        llm = _get_llm_for_model(model_name)
        response = llm.invoke(prompt)
        text = response if isinstance(response, str) else getattr(response, "content", str(response))
        return text.strip()
    except Exception as e:
        print(f"[langchain_ollama] generate_with_model error ({model_name}): {e}")
        if lt and mn == lt:
            _level_test_primary_failed = True
            _model_instances.pop(mn, None)
            print(
                "[langchain_ollama] Disabling level-test primary model for this process; "
                "next calls use OLLAMA_MODEL. Fix GPU/VRAM or set OLLAMA_LEVEL_TEST_MODEL=mistral in .env."
            )
        return ""


if __name__ == "__main__":
    print("Running Ollama connection test...")
    success = test_ollama_connection()
    print("Test result:", "PASSED" if success else "FAILED")
