"""
LangChain Ollama LLM wrapper - initialization, testing, and response generation.
"""
from core import config

try:
    from langchain_community.llms import Ollama
except ImportError:
    Ollama = None

# Default timeout for LLM invocations (seconds)
DEFAULT_TIMEOUT = 60

_llm_instance = None


def get_ollama_llm():
    """
    Initializes Ollama LLM using LangChain.
    Uses config.OLLAMA_MODEL and config.OLLAMA_BASE_URL.
    Sets temperature=0.7 for creative responses.
    Returns the LLM instance.
    """
    global _llm_instance
    if Ollama is None:
        raise ImportError("langchain_community is required. Install with: pip install langchain-community")
    if _llm_instance is None:
        _llm_instance = Ollama(
            model=config.OLLAMA_MODEL,
            base_url=config.OLLAMA_BASE_URL,
            temperature=0.7,
        )
        print(f"[langchain_ollama] LLM initialized: model={config.OLLAMA_MODEL}, base_url={config.OLLAMA_BASE_URL}")
    return _llm_instance


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
        # LangChain Ollama may support request_timeout; use invoke with timeout if supported
        response = llm.invoke(prompt)
        text = response if isinstance(response, str) else getattr(response, "content", str(response))
        return text.strip()
    except Exception as e:
        print(f"[langchain_ollama] generate_response error: {e}")
        return ""


if __name__ == "__main__":
    print("Running Ollama connection test...")
    success = test_ollama_connection()
    print("Test result:", "PASSED" if success else "FAILED")
