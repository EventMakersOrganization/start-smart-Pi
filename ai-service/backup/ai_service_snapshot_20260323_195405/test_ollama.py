from langchain_ollama import OllamaLLM

llm = OllamaLLM(model="llama2")

response = llm.invoke("Explain database in simple words.")

print(response)