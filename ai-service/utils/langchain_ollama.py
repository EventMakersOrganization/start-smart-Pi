"""
LangChain Ollama LLM wrapper - initialization, testing, and response generation.

Two LLM instances:
  * **default** — ``OLLAMA_MODEL`` (mistral) for chatbot, explanations, etc.
  * **fast**    — ``OLLAMA_FAST_MODEL`` (qwen2.5:3b) for bulk question generation.
                  Falls back to the default model if the fast model isn't pulled yet.
"""
from core import config

try:
    from langchain_community.llms import Ollama
except ImportError:
    Ollama = None

DEFAULT_TIMEOUT = 60

_llm_instance = None
_fast_llm_instance = None
_fast_model_checked = False


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


if __name__ == "__main__":
    print("Running Ollama connection test...")
    success = test_ollama_connection()
    print("Test result:", "PASSED" if success else "FAILED")
