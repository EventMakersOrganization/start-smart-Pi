"""
ChromaDB setup module - persistent client and collection helpers.
"""
import chromadb

from . import config

# Persistent client (initialized on first use)
_chroma_client = None


def get_chroma_client():
    """
    Returns the initialized ChromaDB PersistentClient.
    Uses CHROMA_PERSIST_DIRECTORY from config for data persistence.
    """
    global _chroma_client
    try:
        if _chroma_client is None:
            path = config.CHROMA_PERSIST_DIRECTORY
            _chroma_client = chromadb.PersistentClient(path=path)
            print(f"[chroma_setup] ChromaDB PersistentClient initialized at: {path}")
        return _chroma_client
    except Exception as e:
        print(f"[chroma_setup] Error initializing ChromaDB client: {e}")
        raise


def get_or_create_collection(collection_name="course_embeddings"):
    """
    Gets existing collection or creates a new one.
    Collection stores: documents (course text), embeddings (vectors),
    metadatas (course_id, title, level, instructorId), ids (unique identifiers).
    Returns the collection object.
    """
    try:
        client = get_chroma_client()
        collection = client.get_or_create_collection(
            name=collection_name,
            metadata={"description": "Course embeddings for semantic search"},
        )
        print(f"[chroma_setup] Collection '{collection_name}' ready.")
        return collection
    except Exception as e:
        print(f"[chroma_setup] Error getting/creating collection '{collection_name}': {e}")
        raise


def delete_collection(collection_name="course_embeddings"):
    """
    Deletes the collection. Useful for testing/reset.
    """
    try:
        client = get_chroma_client()
        client.delete_collection(name=collection_name)
        print(f"[chroma_setup] Collection '{collection_name}' deleted successfully.")
    except ValueError as e:
        print(f"[chroma_setup] delete_collection: Collection '{collection_name}' not found. {e}")
    except Exception as e:
        print(f"[chroma_setup] Error deleting collection '{collection_name}': {e}")
        raise


def get_collection_info(collection_name="course_embeddings"):
    """
    Returns information about the collection.
    Prints count of items and sample metadata.
    """
    try:
        client = get_chroma_client()
        collection = client.get_collection(name=collection_name)
        count = collection.count()
        print(f"[chroma_setup] Collection '{collection_name}': {count} item(s).")
        info = {"name": collection_name, "count": count}
        if count > 0:
            sample = collection.peek(limit=1)
            info["sample_ids"] = sample.get("ids", [])
            info["sample_metadatas"] = sample.get("metadatas", [])
            print(f"[chroma_setup] Sample id: {info['sample_ids']}")
            print(f"[chroma_setup] Sample metadata: {info['sample_metadatas']}")
        return info
    except ValueError as e:
        print(f"[chroma_setup] get_collection_info: Collection '{collection_name}' not found. {e}")
        return {"name": collection_name, "count": 0, "error": str(e)}
    except Exception as e:
        print(f"[chroma_setup] Error getting collection info: {e}")
        raise


def test_chroma():
    """
    Tests ChromaDB setup: creates collection, prints collection info.
    Returns True if successful.
    """
    try:
        print("[chroma_setup] Testing ChromaDB setup...")
        collection = get_or_create_collection(collection_name="course_embeddings")
        info = get_collection_info(collection_name="course_embeddings")
        print("[chroma_setup] test_chroma: Success.")
        return True
    except Exception as e:
        print(f"[chroma_setup] test_chroma failed: {e}")
        return False


if __name__ == "__main__":
    print("Running ChromaDB setup test...")
    success = test_chroma()
    print("Test result:", "PASSED" if success else "FAILED")
