"""
Embeddings pipeline - generate embeddings from courses and store in ChromaDB.
Uses Ollama for embeddings and ChromaDB for vector storage.
"""
import argparse
import json
import logging
from pathlib import Path

from core import config, db_connection, chroma_setup
from core.paths import logs_dir

try:
    import ollama
except ImportError:
    ollama = None

from embeddings.embedding_cache import EmbeddingCache

_query_cache = EmbeddingCache(cache_dir="./embedding_query_cache", max_size_mb=100)


# --- Logging setup (under ai-service/logs/) ---

_LOG_PATH = logs_dir() / "embeddings.log"
_ERROR_LOG_PATH = logs_dir() / "embeddings_error.log"

logger = logging.getLogger("embeddings_pipeline")
logger.setLevel(logging.INFO)
if not logger.handlers:
    formatter = logging.Formatter("%(asctime)s - %(levelname)s - %(message)s")

    file_handler = logging.FileHandler(_LOG_PATH, encoding="utf-8")
    file_handler.setLevel(logging.INFO)
    file_handler.setFormatter(formatter)

    error_handler = logging.FileHandler(_ERROR_LOG_PATH, encoding="utf-8")
    error_handler.setLevel(logging.ERROR)
    error_handler.setFormatter(formatter)

    logger.addHandler(file_handler)
    logger.addHandler(error_handler)


def generate_embedding(text, use_cache=True):
    """
    Generates embedding for the given text using Ollama.
    Uses config.OLLAMA_EMBED_MODEL (dedicated embedding model) when available,
    falling back to config.OLLAMA_MODEL.
    Results are cached in-memory + on-disk for fast repeat queries.
    Returns the embedding vector (list of floats).
    """
    if ollama is None:
        msg = "[embeddings_pipeline] Error: ollama package not installed."
        print(msg)
        logger.error(msg)
        return None
    if not text or not str(text).strip():
        msg = "[embeddings_pipeline] generate_embedding: empty text, returning None."
        print(msg)
        logger.warning(msg)
        return None

    cache_key = text.strip()[:500]
    if use_cache:
        cached = _query_cache.get(cache_key)
        if cached is not None:
            logger.debug("Embedding cache hit (len=%d)", len(cached))
            return cached

    try:
        model = getattr(config, "OLLAMA_EMBED_MODEL", None) or config.OLLAMA_MODEL
        logger.info("Generating embedding (model=%s)...", model)
        response = ollama.embed(model=model, input=text)
        embeddings = response.get("embeddings")
        if not embeddings:
            msg = "[embeddings_pipeline] generate_embedding: no embeddings in response."
            print(msg)
            logger.error(msg)
            return None
        vector = embeddings[0] if isinstance(embeddings[0], list) else embeddings
        logger.info("Embedding generated, dimension: %d", len(vector))

        if use_cache:
            _query_cache.set(cache_key, vector)

        return vector
    except Exception as e:
        msg = f"[embeddings_pipeline] generate_embedding error: {e}"
        print(msg)
        logger.error(msg)
        return None


def prepare_course_text(course):
    """
    Combines course title, description, and stringified subchapters into one text.
    Handles missing fields gracefully.
    """
    parts = []
    if course.get("title"):
        parts.append(str(course["title"]))
    if course.get("description"):
        parts.append(str(course["description"]))
    sub_chapters = course.get("subChapters") or course.get("subchapters")
    if sub_chapters is not None:
        if isinstance(sub_chapters, list):
            parts.append("Subchapters: " + json.dumps(sub_chapters, default=str))
        else:
            parts.append("Subchapters: " + str(sub_chapters))
    text = "\n".join(parts) if parts else ""
    return text


def check_existing_embedding(course_id, collection):
    """
    Checks if course already has an embedding in ChromaDB.
    Returns True if exists, False otherwise.
    """
    try:
        result = collection.get(ids=[str(course_id)])
        ids = result.get("ids") or []
        exists = bool(ids and ids[0])
        logger.info("check_existing_embedding: course_id=%s exists=%s", course_id, exists)
        return exists
    except Exception as e:
        msg = f"[embeddings_pipeline] check_existing_embedding error for course_id={course_id}: {e}"
        print(msg)
        logger.error(msg)
        return False


def process_single_course(course, collection):
    """
    Prepares course text, generates embedding, stores in ChromaDB.
    Uses course id, document, embedding, metadata (course_id, title, level, instructorId).
    Returns True if successful.
    """
    try:
        course_id = str(course.get("id") or course.get("_id", ""))
        if not course_id:
            msg = "[embeddings_pipeline] process_single_course: course has no id, skipping."
            print(msg)
            logger.warning(msg)
            return False

        text = prepare_course_text(course)
        if not text.strip():
            msg = f"[embeddings_pipeline] process_single_course: no text for course {course_id}, skipping."
            print(msg)
            logger.warning(msg)
            return False

        embedding = generate_embedding(text)
        if embedding is None:
            msg = f"[embeddings_pipeline] process_single_course: failed to generate embedding for {course_id}."
            print(msg)
            logger.error(msg)
            return False

        title = course.get("title") or ""
        level = course.get("level") or ""
        instructor_id = course.get("instructorId") or ""
        if isinstance(instructor_id, dict):
            instructor_id = str(instructor_id.get("id", instructor_id))
        else:
            instructor_id = str(instructor_id)

        collection.add(
            ids=[course_id],
            documents=[text],
            embeddings=[embedding],
            metadatas=[{
                "course_id": course_id,
                "title": title,
                "level": str(level),
                "instructorId": instructor_id,
            }],
        )
        msg = f"[embeddings_pipeline] Stored course: '{title}' (id={course_id})"
        print(msg)
        logger.info(msg)
        return True
    except Exception as e:
        msg = f"[embeddings_pipeline] process_single_course error: {e}"
        print(msg)
        logger.error(msg)
        return False


def process_all_courses(collection_name="course_embeddings", force_reembed=False):
    """
    Fetches all courses from MongoDB, gets ChromaDB collection,
    processes each course and stores embeddings.
    Skips courses that already have embeddings unless force_reembed=True.
    Returns count of successfully processed courses.
    """
    msg = f"[embeddings_pipeline] process_all_courses: starting... force_reembed={force_reembed}"
    print(msg)
    logger.info(msg)
    courses = db_connection.get_all_courses()
    if not courses:
        msg = "[embeddings_pipeline] process_all_courses: no courses in database."
        print(msg)
        logger.info(msg)
        return 0

    try:
        collection = chroma_setup.get_or_create_collection(collection_name=collection_name)
    except Exception as e:
        msg = f"[embeddings_pipeline] process_all_courses: could not get collection: {e}"
        print(msg)
        logger.error(msg)
        return 0

    total = len(courses)
    success_count = 0
    skipped_count = 0
    for i, course in enumerate(courses):
        course_id = str(course.get("id") or course.get("_id", ""))
        print(f"[embeddings_pipeline] Processing {i + 1}/{total} course_id={course_id}...")
        if not force_reembed and course_id:
            if check_existing_embedding(course_id, collection):
                msg = f"[embeddings_pipeline] Skipping existing embedding for course_id={course_id}"
                print(msg)
                logger.info(msg)
                skipped_count += 1
                continue
        if process_single_course(course, collection):
            success_count += 1

    summary = (
        f"[embeddings_pipeline] process_all_courses: done. "
        f"Embedded {success_count} new courses, skipped {skipped_count} existing (total={total})."
    )
    print(summary)
    logger.info(summary)
    return success_count


def search_similar_courses(query_text, n_results=5, collection_name="course_embeddings"):
    """
    Embeds the query, searches ChromaDB, returns top n_results with
    metadata, similarity scores, and documents. Prints formatted results.
    """
    preview = (query_text[:50] + "...") if len(query_text) > 50 else query_text
    msg = f"[embeddings_pipeline] search_similar_courses: query='{preview}' n_results={n_results}"
    print(msg)
    logger.info(msg)
    if not query_text or not str(query_text).strip():
        msg = "[embeddings_pipeline] search_similar_courses: empty query."
        print(msg)
        logger.warning(msg)
        return []

    embedding = generate_embedding(query_text)
    if embedding is None:
        msg = "[embeddings_pipeline] search_similar_courses: could not embed query."
        print(msg)
        logger.error(msg)
        return []

    try:
        collection = chroma_setup.get_or_create_collection(collection_name=collection_name)
    except Exception as e:
        msg = f"[embeddings_pipeline] search_similar_courses: could not get collection: {e}"
        print(msg)
        logger.error(msg)
        return []

    try:
        results = collection.query(
            query_embeddings=[embedding],
            n_results=n_results,
            include=["metadatas", "documents", "distances"],
        )
    except Exception as e:
        msg = f"[embeddings_pipeline] search_similar_courses query error: {e}"
        print(msg)
        logger.error(msg)
        return []

    # Columnar format: each key has list of lists (one per query)
    ids = (results.get("ids") or [[]])[0]
    metadatas = (results.get("metadatas") or [[]])[0]
    documents = (results.get("documents") or [[]])[0]
    distances = (results.get("distances") or [[]])[0]

    out = []
    print("[embeddings_pipeline] --- Search results ---")
    logger.info("[embeddings_pipeline] --- Search results ---")
    for j, (cid, meta, doc, dist) in enumerate(zip(ids, metadatas, documents, distances)):
        item = {"id": cid, "metadata": meta or {}, "document": doc, "distance": dist}
        out.append(item)
        line = f"  {j + 1}. id={cid} distance={dist:.4f} title={(meta or {}).get('title', '')}"
        print(line)
        logger.info(line)
        if doc:
            snippet = f"     snippet: {str(doc)[:80]}..."
            print(snippet)
            logger.info(snippet)
    msg = f"[embeddings_pipeline] Returned {len(out)} result(s)."
    print(msg)
    logger.info(msg)
    return out


def embed_course_by_id(course_id, collection_name="course_embeddings", force_reembed=False):
    """
    Embeds a single specific course by ID.
    Returns True if successful (or already embedded when not forcing), False otherwise.
    """
    try:
        course = db_connection.get_course_by_id(course_id)
        if not course:
            msg = f"[embeddings_pipeline] embed_course_by_id: course_id={course_id} not found."
            print(msg)
            logger.error(msg)
            return False
        collection = chroma_setup.get_or_create_collection(collection_name=collection_name)
        if not force_reembed and check_existing_embedding(course_id, collection):
            msg = f"[embeddings_pipeline] embed_course_by_id: embedding already exists for course_id={course_id}, skipping."
            print(msg)
            logger.info(msg)
            return True
        ok = process_single_course(course, collection)
        return ok
    except Exception as e:
        msg = f"[embeddings_pipeline] embed_course_by_id error for course_id={course_id}: {e}"
        print(msg)
        logger.error(msg)
        return False


def get_course_context(course_id, collection_name="course_embeddings"):
    """
    Retrieves course document and embedding from ChromaDB.
    Returns a context dict useful for RAG / chatbot integration.
    """
    try:
        course = db_connection.get_course_by_id(course_id)
        if not course:
            msg = f"[embeddings_pipeline] get_course_context: course_id={course_id} not found in MongoDB."
            print(msg)
            logger.error(msg)
            return None
        collection = chroma_setup.get_or_create_collection(collection_name=collection_name)
        result = collection.get(ids=[str(course_id)], include=["metadatas", "documents", "embeddings"])
        raw_ids = result.get("ids") or []
        # Chroma may return list-of-lists or arrays; avoid boolean on arrays (ambiguous truth value)
        if len(raw_ids) == 0:
            msg = f"[embeddings_pipeline] get_course_context: no embedding found for course_id={course_id}."
            print(msg)
            logger.info(msg)
            return {"course": course, "embedding": None, "document": None, "metadata": None}
        first_batch = raw_ids[0]
        try:
            first_len = len(first_batch) if hasattr(first_batch, "__len__") else 1
        except Exception:
            first_len = 0
        if first_len == 0:
            msg = f"[embeddings_pipeline] get_course_context: no embedding found for course_id={course_id}."
            print(msg)
            logger.info(msg)
            return {"course": course, "embedding": None, "document": None, "metadata": None}
        metadatas = (result.get("metadatas") or [[]])[0]
        documents = (result.get("documents") or [[]])[0]
        embeddings = (result.get("embeddings") or [[]])[0]
        # Avoid "truth value of array ambiguous" when values are numpy arrays
        meta = metadatas[0] if isinstance(metadatas, list) and len(metadatas) > 0 else metadatas
        doc = documents[0] if isinstance(documents, list) and len(documents) > 0 else documents
        if isinstance(embeddings, list) and len(embeddings) > 0:
            embedding_vec = embeddings[0]
        else:
            embedding_vec = embeddings
        context = {
            "course": course,
            "metadata": meta,
            "document": doc,
            "embedding": embedding_vec,
        }
        logger.info("[embeddings_pipeline] get_course_context: retrieved context for course_id=%s", course_id)
        return context
    except Exception as e:
        msg = f"[embeddings_pipeline] get_course_context error for course_id={course_id}: {e}"
        print(msg)
        logger.error(msg)
        return None


def update_embedding(course_id, collection_name="course_embeddings"):
    """
    Deletes old embedding (if exists) and creates a new one with current course content.
    Returns True if successful.
    """
    try:
        collection = chroma_setup.get_or_create_collection(collection_name=collection_name)
        if check_existing_embedding(course_id, collection):
            try:
                collection.delete(ids=[str(course_id)])
                msg = f"[embeddings_pipeline] update_embedding: deleted old embedding for course_id={course_id}."
                print(msg)
                logger.info(msg)
            except Exception as e:
                msg = f"[embeddings_pipeline] update_embedding: failed to delete old embedding for course_id={course_id}: {e}"
                print(msg)
                logger.error(msg)
        ok = embed_course_by_id(course_id, collection_name=collection_name, force_reembed=True)
        return ok
    except Exception as e:
        msg = f"[embeddings_pipeline] update_embedding error for course_id={course_id}: {e}"
        print(msg)
        logger.error(msg)
        return False


def test_pipeline():
    """
    Runs a full test demonstrating core embedding/search operations.
    Returns True if successful.
    """
    print("[embeddings_pipeline] test_pipeline: starting...")
    logger.info("[embeddings_pipeline] test_pipeline: starting...")
    if ollama is None:
        msg = "[embeddings_pipeline] test_pipeline: ollama package not installed. FAILED."
        print(msg)
        logger.error(msg)
        return False

    try:
        processed = process_all_courses()
        print(f"[embeddings_pipeline] test_pipeline: process_all_courses embedded {processed} courses.")
        logger.info("[embeddings_pipeline] test_pipeline: process_all_courses embedded %s courses.", processed)
    except Exception as e:
        msg = f"[embeddings_pipeline] test_pipeline: process_all_courses failed: {e}"
        print(msg)
        logger.error(msg)
        return False

    # Try to demonstrate per-course operations if we have at least one course
    courses = db_connection.get_all_courses()
    if courses:
        sample_id = str(courses[0].get("id") or courses[0].get("_id", ""))
        if sample_id:
            print(f"[embeddings_pipeline] test_pipeline: using sample course_id={sample_id}")
            logger.info("[embeddings_pipeline] test_pipeline: using sample course_id=%s", sample_id)
            try:
                embed_course_by_id(sample_id)
                ctx = get_course_context(sample_id)
                print(f"[embeddings_pipeline] test_pipeline: context document snippet: {(ctx or {}).get('document', '')[:80]}")
                update_embedding(sample_id)
            except Exception as e:
                msg = f"[embeddings_pipeline] test_pipeline: per-course operations failed: {e}"
                print(msg)
                logger.error(msg)

    try:
        results = search_similar_courses("introduction to programming", n_results=3)
        print(f"[embeddings_pipeline] test_pipeline: sample search returned {len(results)} result(s).")
        logger.info("[embeddings_pipeline] test_pipeline: sample search returned %s result(s).", len(results))
    except Exception as e:
        msg = f"[embeddings_pipeline] test_pipeline: search failed: {e}"
        print(msg)
        logger.error(msg)
        return False

    print("[embeddings_pipeline] test_pipeline: Success.")
    logger.info("[embeddings_pipeline] test_pipeline: Success.")
    return True


def main():
    parser = argparse.ArgumentParser(description="Embeddings pipeline CLI")
    group = parser.add_mutually_exclusive_group()
    group.add_argument("--embed-all", action="store_true", help="Embed all courses (re-embed existing)")
    group.add_argument("--embed-course", metavar="COURSE_ID", help="Embed a single course by ID")
    group.add_argument("--search", metavar="QUERY", help="Search similar courses for a query")
    parser.add_argument("--n-results", type=int, default=5, help="Number of results for search (default: 5)")
    args = parser.parse_args()

    if args.embed_all:
        print("[embeddings_pipeline] CLI: embedding all courses (force re-embed).")
        logger.info("[embeddings_pipeline] CLI: embedding all courses (force re-embed).")
        count = process_all_courses(force_reembed=True)
        print(f"[embeddings_pipeline] CLI: embedded {count} courses.")
        logger.info("[embeddings_pipeline] CLI: embedded %s courses.", count)
    elif args.embed_course:
        cid = args.embed_course
        print(f"[embeddings_pipeline] CLI: embedding course_id={cid}")
        logger.info("[embeddings_pipeline] CLI: embedding course_id=%s", cid)
        ok = embed_course_by_id(cid, force_reembed=True)
        print(f"[embeddings_pipeline] CLI: embed_course_by_id success={ok}")
        logger.info("[embeddings_pipeline] CLI: embed_course_by_id success=%s", ok)
    elif args.search:
        query = args.search
        print(f"[embeddings_pipeline] CLI: searching for '{query}' (n_results={args.n_results})")
        logger.info("[embeddings_pipeline] CLI: searching for '%s' (n_results=%s)", query, args.n_results)
        results = search_similar_courses(query, n_results=args.n_results)
        for i, item in enumerate(results, start=1):
            meta = item.get("metadata") or {}
            dist = item.get("distance", 1.0)
            similarity = 1.0 / (1.0 + float(dist)) if dist is not None else 0.0
            print(
                f"{i}. id={item.get('id')} "
                f"title={meta.get('title', '')} "
                f"similarity={similarity:.4f}"
            )
    else:
        print("Running embeddings pipeline test...")
        success = test_pipeline()
        print("Test result:", "PASSED" if success else "FAILED")


if __name__ == "__main__":
    main()
