"""
RAG pipeline v2: chunk-based embeddings and search.
Uses document_chunker for intelligent chunking and a dedicated ChromaDB collection for chunks.
"""
import json
import logging

from core import config, chroma_setup, db_connection
from core.paths import logs_dir
from rag import document_chunker

# Import original pipeline for generate_embedding and search
from . import embeddings_pipeline

try:
    import ollama
except ImportError:
    ollama = None


# --- Logging (under ai-service/logs/) ---
_V2_LOG_PATH = logs_dir() / "embeddings_v2.log"

logger = logging.getLogger("embeddings_v2")
logger.setLevel(logging.INFO)
logger.handlers.clear()
_formatter = logging.Formatter("%(asctime)s - %(levelname)s - %(message)s")
_fh = logging.FileHandler(_V2_LOG_PATH, encoding="utf-8")
_fh.setLevel(logging.INFO)
_fh.setFormatter(_formatter)
logger.addHandler(_fh)


DEFAULT_CHUNK_COLLECTION = "course_chunks"

_collection_cache: dict = {}


def get_or_create_chunked_collection(collection_name: str = "course_chunks"):
    """
    Creates or gets a ChromaDB collection for chunk embeddings.
    Caches the collection object to avoid repeated Chroma round-trips.
    """
    if collection_name in _collection_cache:
        return _collection_cache[collection_name]
    try:
        coll = chroma_setup.get_or_create_collection(collection_name=collection_name)
        _collection_cache[collection_name] = coll
        logger.info("get_or_create_chunked_collection: '%s' ready (cached)", collection_name)
        return coll
    except Exception as e:
        logger.error("get_or_create_chunked_collection error: %s", e)
        raise


def _chunk_to_metadata(chunk: dict) -> dict:
    """Flatten chunk metadata for Chroma (str, int, float, bool only)."""
    meta = chunk.get("metadata") or {}
    return {
        "course_id": str(chunk.get("course_id") or ""),
        "chunk_type": str(chunk.get("chunk_type") or "text"),
        "chunk_index": int(meta.get("chunk_index", 0)),
        "course_title": str(meta.get("course_title") or "")[:500],
        "module_name": str(meta.get("module_name") or "")[:500],
    }


def embed_chunk(chunk_dict: dict, max_retries: int = 2) -> dict:
    """
    Generates embedding for chunk['text'] using Ollama.
    Returns chunk_dict with added 'embedding' field. On failure, embedding is None.
    """
    text = chunk_dict.get("text") or ""
    if not str(text).strip():
        logger.warning("embed_chunk: empty text for chunk_id=%s", chunk_dict.get("chunk_id"))
        chunk_dict["embedding"] = None
        return chunk_dict
    for attempt in range(max_retries + 1):
        try:
            emb = embeddings_pipeline.generate_embedding(text)
            chunk_dict["embedding"] = emb
            if emb is None and attempt < max_retries:
                continue
            return chunk_dict
        except Exception as e:
            logger.warning("embed_chunk attempt %s: %s", attempt + 1, e)
            if attempt == max_retries:
                chunk_dict["embedding"] = None
                return chunk_dict
    return chunk_dict


def embed_all_chunks(chunks: list[dict], show_progress: bool = True) -> list[dict]:
    """Embeds a list of chunks; shows progress. Returns chunks with 'embedding' added."""
    total = len(chunks)
    out = []
    for i, c in enumerate(chunks):
        if show_progress:
            print(f"Embedding chunk {i + 1}/{total}...")
        out.append(embed_chunk(c))
    return out


def store_chunks_in_chromadb(
    chunks: list[dict],
    collection_name: str = "course_chunks",
    replace_existing: bool = True,
) -> int:
    """
    Stores embedded chunks in ChromaDB. Skips chunks without embedding or duplicate chunk_id.
    Returns count of newly stored chunks.
    """
    if not chunks:
        logger.info("store_chunks_in_chromadb: no chunks")
        return 0
    try:
        collection = get_or_create_chunked_collection(collection_name)
        existing_ids = set()
        try:
            # Peek existing ids to avoid duplicates (Chroma has no get-all by default)
            peek = collection.peek(limit=10000)
            existing_ids = set(peek.get("ids") or [])
        except Exception:
            pass

        ids = []
        documents = []
        embeddings = []
        metadatas = []
        for c in chunks:
            if c.get("embedding") is None:
                continue
            cid = c.get("chunk_id")
            if not cid:
                continue
            ids.append(cid)
            documents.append((c.get("text") or "")[:100000])
            embeddings.append(c["embedding"])
            metadatas.append(_chunk_to_metadata(c))
            existing_ids.add(cid)

        if not ids:
            logger.info("store_chunks_in_chromadb: no new chunks to add (all skipped)")
            return 0
        if replace_existing and ids:
            try:
                collection.delete(ids=ids)
            except Exception:
                # Best-effort delete; add still works for new ids.
                pass
        collection.add(ids=ids, documents=documents, embeddings=embeddings, metadatas=metadatas)
        logger.info("store_chunks_in_chromadb: stored %s chunks", len(ids))
        return len(ids)
    except Exception as e:
        logger.error("store_chunks_in_chromadb error: %s", e)
        raise


def process_and_embed_course_chunks(
    course_id: str,
    collection_name: str = "course_chunks",
    chunk_size: int = 500,
) -> tuple[bool, int]:
    """
    Fetches course from MongoDB, chunks it, embeds chunks, stores in ChromaDB.
    Returns (success, chunk_count).
    """
    try:
        course = db_connection.get_course_by_id(course_id)
        if not course:
            logger.error("process_and_embed_course_chunks: course_id=%s not found", course_id)
            return False, 0
        chunks = document_chunker.chunk_course_content(course)
        if not chunks:
            logger.warning("process_and_embed_course_chunks: no chunks for course_id=%s", course_id)
            return True, 0
        chunks = embed_all_chunks(chunks, show_progress=True)
        stored = store_chunks_in_chromadb(chunks, collection_name=collection_name)
        logger.info("process_and_embed_course_chunks: course_id=%s stored=%s", course_id, stored)
        return True, stored
    except Exception as e:
        logger.error("process_and_embed_course_chunks error for course_id=%s: %s", course_id, e)
        return False, 0


def process_all_courses_chunked(
    collection_name: str = "course_chunks",
    chunk_size: int = 500,
) -> int:
    """Processes all courses: chunk, embed, store. Returns total chunks created."""
    courses = db_connection.get_all_courses()
    if not courses:
        logger.info("process_all_courses_chunked: no courses")
        return 0
    total_chunks = 0
    for i, course in enumerate(courses):
        cid = str(course.get("id") or course.get("_id", ""))
        print(f"Processing course {i + 1}/{len(courses)}: {cid}")
        ok, n = process_and_embed_course_chunks(cid, collection_name=collection_name, chunk_size=chunk_size)
        if ok:
            total_chunks += n
    print(f"Total chunks stored: {total_chunks}")
    logger.info("process_all_courses_chunked: total_chunks=%s", total_chunks)
    return total_chunks


def search_chunks(
    query: str,
    n_results: int = 10,
    filter_metadata: dict = None,
    collection_name: str = "course_chunks",
    where_document: dict = None,
) -> list[dict]:
    """
    Embeds query, searches chunk collection, optional metadata filter.
    Optional where_document: Chroma document filter, e.g. {"$contains": "substring"}.
    Returns list of {chunk_text, course_id, metadata, similarity} (distance -> similarity).
    """
    if not query or not str(query).strip():
        logger.warning("search_chunks: empty query")
        return []
    emb = embeddings_pipeline.generate_embedding(query)
    if emb is None:
        logger.error("search_chunks: could not embed query")
        return []
    try:
        collection = get_or_create_chunked_collection(collection_name)
        kwargs = {
            "query_embeddings": [emb],
            "n_results": n_results,
            "include": ["metadatas", "documents", "distances"],
        }
        if filter_metadata:
            kwargs["where"] = filter_metadata
        if where_document:
            kwargs["where_document"] = where_document
        results = collection.query(**kwargs)
    except Exception as e:
        logger.error("search_chunks query error: %s", e)
        return []

    ids = (results.get("ids") or [[]])[0]
    metadatas = (results.get("metadatas") or [[]])[0]
    documents = (results.get("documents") or [[]])[0]
    distances = (results.get("distances") or [[]])[0]
    out = []
    for cid, meta, doc, dist in zip(ids, metadatas, documents, distances):
        # Chroma distance: lower is more similar; convert to similarity-like score if needed
        similarity = 1.0 / (1.0 + float(dist)) if dist is not None else 0.0
        out.append({
            "chunk_id": cid,
            "chunk_text": doc,
            "course_id": (meta or {}).get("course_id", ""),
            "metadata": meta or {},
            "similarity": similarity,
            "distance": dist,
        })
    return out


def search_and_aggregate_by_course(
    query: str,
    n_results: int = 5,
    collection_name: str = "course_chunks",
) -> list[dict]:
    """
    Searches chunks, groups by course_id, aggregates scores.
    Returns courses ranked by relevance (e.g. sum of chunk similarities).
    """
    chunks = search_chunks(query, n_results=n_results * 5, collection_name=collection_name)
    by_course = {}
    for c in chunks:
        cid = c.get("course_id") or "unknown"
        if cid not in by_course:
            by_course[cid] = {"course_id": cid, "chunks": [], "total_similarity": 0.0}
        by_course[cid]["chunks"].append(c)
        by_course[cid]["total_similarity"] += c.get("similarity", 0.0)
    ranked = sorted(by_course.values(), key=lambda x: -x["total_similarity"])[:n_results]
    return ranked


def get_course_context(
    course_id: str,
    max_chunks: int = 5,
    collection_name: str = "course_chunks",
) -> str:
    """
    Retrieves all chunks for a course from ChromaDB and combines into context string for RAG.
    """
    try:
        collection = get_or_create_chunked_collection(collection_name)
        # Chroma get by metadata filter
        result = collection.get(
            where={"course_id": course_id},
            limit=max_chunks,
            include=["documents", "metadatas"],
        )
        docs = result.get("documents") or []
        metadatas = result.get("metadatas") or []
        parts = []
        for i, doc in enumerate(docs):
            meta = metadatas[i] if i < len(metadatas) else {}
            label = meta.get("chunk_type", "chunk") + (f" ({meta.get('module_name', '')})" if meta.get("module_name") else "")
            parts.append(f"[{label}]\n{doc}")
        context = "\n\n---\n\n".join(parts) if parts else ""
        logger.info("get_course_context: course_id=%s chunks=%s", course_id, len(parts))
        return context
    except Exception as e:
        logger.error("get_course_context error for course_id=%s: %s", course_id, e)
        return ""


def migrate_from_v1_to_v2(
    v1_collection_name: str = "course_embeddings",
    v2_collection_name: str = "course_chunks",
) -> int:
    """
    Reads full-document embeddings from v1, re-chunks, creates chunk embeddings in v2.
    Keeps v1 collection unchanged. Returns number of chunks stored in v2.
    """
    courses = db_connection.get_all_courses()
    if not courses:
        logger.info("migrate_from_v1_to_v2: no courses")
        return 0
    total = 0
    for course in courses:
        cid = str(course.get("id") or course.get("_id", ""))
        if not cid:
            continue
        print(f"Migrating course {cid}...")
        ok, n = process_and_embed_course_chunks(cid, collection_name=v2_collection_name)
        if ok:
            total += n
    print(f"Migration done. Total chunks in v2: {total}")
    logger.info("migrate_from_v1_to_v2: total_chunks=%s", total)
    return total


def compare_search_methods(
    query: str,
    n_results: int = 5,
    v1_collection: str = "course_embeddings",
    v2_collection: str = "course_chunks",
) -> None:
    """Compares v1 (full-doc) vs v2 (chunk) search and prints a comparison table."""
    print(f"\nQuery: {query}\n")
    v1_results = embeddings_pipeline.search_similar_courses(
        query, n_results=n_results, collection_name=v1_collection
    )
    v2_ranked = search_and_aggregate_by_course(query, n_results=n_results, collection_name=v2_collection)

    print("--- V1 (full document) ---")
    for i, r in enumerate(v1_results, 1):
        mid = (r.get("metadata") or {}).get("course_id", r.get("id", ""))
        title = (r.get("metadata") or {}).get("title", "")
        dist = r.get("distance", 0)
        print(f"  {i}. {mid} | dist={dist:.4f} | {title}")

    print("\n--- V2 (chunked, aggregated by course) ---")
    for i, item in enumerate(v2_ranked, 1):
        cid = item.get("course_id", "")
        score = item.get("total_similarity", 0)
        print(f"  {i}. {cid} | total_similarity={score:.4f} | chunks={len(item.get('chunks', []))}")

    print()


def main():
    import sys
    print("RAG Pipeline V2 - Chunk-based embeddings")
    print("1. Process all courses with chunking")
    print("2. Search chunks")
    print("3. Compare v1 vs v2 search")
    print("4. Migrate from v1 to v2")
    print("5. Get course context for RAG")
    choice = input("Choice [1-5]: ").strip() or "1"

    if choice == "1":
        process_all_courses_chunked()
    elif choice == "2":
        q = input("Search query: ").strip() or "python programming"
        results = search_chunks(q, n_results=10)
        for i, r in enumerate(results[:5], 1):
            print(f"{i}. {r.get('course_id')} score={r.get('similarity', 0):.4f} | {str(r.get('chunk_text', ''))[:80]}...")
    elif choice == "3":
        q = input("Query for comparison: ").strip() or "introduction to programming"
        compare_search_methods(q)
    elif choice == "4":
        migrate_from_v1_to_v2()
    elif choice == "5":
        cid = input("Course ID: ").strip()
        if cid:
            ctx = get_course_context(cid, max_chunks=10)
            print("Context preview:", ctx[:500] + "..." if len(ctx) > 500 else ctx)
        else:
            print("No course ID provided.")
    else:
        print("Invalid choice.")


if __name__ == "__main__":
    main()
