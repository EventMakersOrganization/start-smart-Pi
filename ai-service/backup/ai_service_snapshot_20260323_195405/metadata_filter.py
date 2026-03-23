"""
Advanced metadata-based filtering for ChromaDB chunk collections.
Maps user-friendly criteria to Chroma `where` clauses ($eq, $in, $and, $or, $gte, $lte, $ne, $nin).
"""
from __future__ import annotations

import logging
import re
from collections import Counter
from datetime import datetime, timedelta, timezone
from typing import Any, Callable, Optional, Union

import embeddings_pipeline_v2

logger = logging.getLogger("metadata_filter")

# Logical field names (some map to Chroma keys used in stored chunks)
FILTERABLE_FIELDS = frozenset(
    {
        "difficulty",
        "level",
        "course_id",
        "topic",
        "chunk_type",
        "date_created",
        "language",
        "module_name",
        "course_title",
    }
)

# User-facing "topic" maps to module_name in current pipeline (see embeddings_pipeline_v2._chunk_to_metadata)
FIELD_TO_CHROMA: dict[str, str] = {
    "topic": "module_name",
}


def _chroma_field(field: str) -> str:
    return FIELD_TO_CHROMA.get(field, field)


def combine_filters(filters: list[dict], operator: str = "AND") -> dict:
    """Combine multiple Chroma `where` fragments with $and or $or."""
    cleaned = [f for f in filters if f]
    if not cleaned:
        return {}
    if len(cleaned) == 1:
        return cleaned[0]
    key = "$and" if operator.upper() == "AND" else "$or"
    return {key: cleaned}


def create_student_level_filter(student_profile: dict) -> dict:
    """
    Build filter from level and weak_areas (topics).
    level: beginner | intermediate | advanced
    weak_areas: list of topic strings (matched against module_name)
    """
    level = (student_profile.get("level") or "").strip().lower()
    weak = student_profile.get("weak_areas") or []
    parts: list[dict] = []
    if level:
        parts.append({"level": {"$eq": level}})
    if weak:
        topic_clauses = [{"module_name": {"$eq": str(w)}} for w in weak]
        parts.append({"$or": topic_clauses} if len(topic_clauses) > 1 else topic_clauses[0])
    return combine_filters(parts, "AND")


_DIFFICULTY_ORDER = ["easy", "medium", "hard"]


def create_difficulty_progression_filter(current_difficulty: str) -> dict:
    """Include current difficulty and the next step (easy+medium, medium+hard, hard only)."""
    d = (current_difficulty or "").strip().lower()
    if d not in _DIFFICULTY_ORDER:
        return {"difficulty": {"$eq": d}}
    i = _DIFFICULTY_ORDER.index(d)
    inc = _DIFFICULTY_ORDER[i : i + 2]
    return {"difficulty": {"$in": inc}}


def create_topic_filter_from_text(text: str) -> dict:
    """
    Extract candidate topic tokens from free text and OR them on module_name.
    For partial matching against known values, use MetadataFilter.filter_by_topic with partial=True.
    """
    if not text or not str(text).strip():
        return {}
    words = re.findall(r"\b[a-zA-Z][a-zA-Z0-9_-]{2,}\b", text)
    stop = {
        "the", "and", "for", "are", "but", "not", "you", "all", "can", "her", "was",
        "one", "our", "out", "day", "get", "has", "him", "his", "how", "its", "may",
        "new", "now", "old", "see", "two", "way", "who", "boy", "did", "let", "put",
        "say", "she", "too", "use", "that", "this", "with", "from", "have", "been",
        "what", "when", "will", "your", "about", "into", "than", "then", "them",
    }
    topics = [w.lower() for w in words if w.lower() not in stop][:8]
    if not topics:
        return {}
    if len(topics) == 1:
        return {"module_name": {"$eq": topics[0]}}
    return {"$or": [{"module_name": {"$eq": t}} for t in topics]}


class MetadataFilter:
    """
    Build Chroma-compatible metadata filters and run semantic search with filters applied.
    """

    def __init__(self, collection_name: str | None = None) -> None:
        self.collection_name = collection_name or embeddings_pipeline_v2.DEFAULT_CHUNK_COLLECTION
        self._collection = embeddings_pipeline_v2.get_or_create_chunked_collection(self.collection_name)
        self.filterable_fields = dict(
            difficulty="easy | medium | hard",
            level="beginner | intermediate | advanced",
            course_id="str",
            topic="str (stored as module_name in chunks)",
            chunk_type="overview | module | exercise | text",
            date_created="ISO timestamp or unix float",
            language="en | fr | ...",
        )

    def build_filter(self, criteria: dict) -> dict:
        """
        Convert user-friendly criteria to a ChromaDB `where` clause.
        Supports:
          - Implicit AND: {"difficulty": "easy", "course_id": "x"}
          - Lists: {"difficulty": ["easy", "medium"]} -> $in
          - Operators: {"difficulty": {"op": "ne", "value": "hard"}}
          - Nested: {"$and": [...], "$or": [...]}
          - rules + logic: {"logic": "OR", "rules": [{...}, {...}]}
        """
        if not criteria:
            return {}
        if "$and" in criteria or "$or" in criteria:
            return self._normalize_nested_logical(criteria)
        if "rules" in criteria and isinstance(criteria["rules"], list):
            logic = criteria.get("logic", "AND")
            built = [self.build_filter(r) for r in criteria["rules"] if r]
            return combine_filters(built, logic)
        parts: list[dict] = []
        for key, val in criteria.items():
            if key in ("logic", "rules"):
                continue
            parts.append(self._clause_for_field(key, val))
        if not parts:
            return {}
        if len(parts) == 1:
            return parts[0]
        return {"$and": parts}

    def _normalize_nested_logical(self, clause: dict) -> dict:
        """Recursively turn nested criteria dicts into Chroma fragments."""
        if "$and" in clause:
            subs: list[dict] = []
            for c in clause["$and"]:
                if not isinstance(c, dict):
                    continue
                if "$and" in c or "$or" in c:
                    subs.append(self._normalize_nested_logical(c))
                else:
                    subs.append(self.build_filter(c))
            subs = [s for s in subs if s]
            if not subs:
                return {}
            if len(subs) == 1:
                return subs[0]
            return {"$and": subs}
        if "$or" in clause:
            subs = []
            for c in clause["$or"]:
                if not isinstance(c, dict):
                    continue
                if "$and" in c or "$or" in c:
                    subs.append(self._normalize_nested_logical(c))
                else:
                    subs.append(self.build_filter(c))
            subs = [s for s in subs if s]
            if not subs:
                return {}
            if len(subs) == 1:
                return subs[0]
            return {"$or": subs}
        return clause

    def _clause_for_field(self, field: str, value: Any) -> dict:
        chroma_f = _chroma_field(field)
        if isinstance(value, dict) and ("op" in value or "operator" in value):
            op = (value.get("op") or value.get("operator") or "equals").lower()
            val = value.get("value", value.get("v"))
            return self._operator_clause(chroma_f, op, val)
        if isinstance(value, list):
            return {chroma_f: {"$in": [self._coerce_val(x) for x in value]}}
        return {chroma_f: {"$eq": self._coerce_val(value)}}

    def _operator_clause(self, chroma_f: str, op: str, val: Any) -> dict:
        v = self._coerce_val(val)
        op_l = op.lower()
        if op_l in ("contains", "substring"):
            # Substring on metadata: resolve topic via distinct values; else post-filter in search
            if chroma_f == _chroma_field("topic"):
                return self._resolve_topic_partial(str(val))
            return {
                "$eq": "__CONTAINS_PENDING__",
                "__field__": chroma_f,
                "__substr__": str(val),
            }
        mapping = {
            "equals": "$eq",
            "eq": "$eq",
            "ne": "$ne",
            "not_equals": "$ne",
            "greater_than": "$gt",
            "gt": "$gt",
            "greater_than_or_equal": "$gte",
            "gte": "$gte",
            "less_than": "$lt",
            "lt": "$lt",
            "less_than_or_equal": "$lte",
            "lte": "$lte",
            "in": "$in",
            "nin": "$nin",
            "not_in": "$nin",
        }
        chroma_op = mapping.get(op_l, "$eq")
        if chroma_op in ("$in", "$nin") and not isinstance(v, list):
            v = [v]
        return {chroma_f: {chroma_op: v}}

    @staticmethod
    def _coerce_val(val: Any) -> Any:
        if isinstance(val, datetime):
            return val.isoformat()
        return val

    def _strip_pending_placeholders(self, where: dict) -> tuple[dict, list[dict]]:
        """Remove synthetic contains markers; return real where + pending contains specs."""
        pending: list[dict] = []

        def walk(node: Any) -> Any:
            if not isinstance(node, dict):
                return node
            if node.get("$eq") == "__CONTAINS_PENDING__":
                pending.append({"field": node.get("__field__"), "substr": node.get("__substr__")})
                return None
            out = {}
            for k, v in node.items():
                if k.startswith("__"):
                    continue
                if k in ("$and", "$or") and isinstance(v, list):
                    sub = [walk(x) for x in v]
                    sub = [x for x in sub if x is not None]
                    if sub:
                        out[k] = sub
                else:
                    w = walk(v)
                    if w is not None:
                        out[k] = w
            return out or None

        cleaned = walk(where)
        if cleaned is None:
            cleaned = {}
        return cleaned, pending

    def filter_by_difficulty(self, difficulty: Union[str, list[str]]) -> dict:
        if isinstance(difficulty, list):
            return {"difficulty": {"$in": difficulty}}
        return {"difficulty": {"$eq": difficulty}}

    def filter_by_course(self, course_id: Union[str, list[str]]) -> dict:
        if isinstance(course_id, list):
            return {"course_id": {"$in": [str(x) for x in course_id]}}
        return {"course_id": {"$eq": str(course_id)}}

    def filter_by_topic(
        self,
        topic: Union[str, list[str]],
        partial: bool = False,
    ) -> dict:
        """
        Filter by topic (maps to module_name). If partial=True, substring match against
        distinct module_name values (via get_available_metadata_values) -> $in.
        """
        chroma_f = _chroma_field("topic")
        if isinstance(topic, list):
            return {chroma_f: {"$in": list(topic)}}
        if partial:
            return self._resolve_topic_partial(str(topic))
        return {chroma_f: {"$eq": topic}}

    def filter_by_date_range(
        self,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
    ) -> dict:
        """Filter date_created (ISO string or numeric stored in metadata)."""
        parts: list[dict] = []
        if start_date:
            parts.append({"date_created": {"$gte": start_date}})
        if end_date:
            parts.append({"date_created": {"$lte": end_date}})
        if not parts:
            return {}
        return parts[0] if len(parts) == 1 else {"$and": parts}

    def filter_by_chunk_type(self, chunk_type: Union[str, list[str]]) -> dict:
        if isinstance(chunk_type, list):
            return {"chunk_type": {"$in": chunk_type}}
        return {"chunk_type": {"$eq": chunk_type}}

    def combine_filters(self, filters: list[dict], operator: str = "AND") -> dict:
        return combine_filters(filters, operator)

    def _resolve_topic_partial(self, topic: str) -> dict:
        """Build $in clause over module_name values that contain topic (case-insensitive)."""
        vals = self.get_available_metadata_values("topic")
        t = topic.lower()
        match = [v for v in vals if t in str(v).lower()]
        if not match:
            return {_chroma_field("topic"): {"$eq": "__no_match__"}}
        return {_chroma_field("topic"): {"$in": match}}

    def search_with_filters(
        self,
        query: str,
        filter_criteria: dict,
        n_results: int = 10,
    ) -> list[dict]:
        """
        Build filter from criteria (contains on non-topic fields uses post-filter), run semantic search.
        """
        where = self.build_filter(filter_criteria)
        where, pending = self._strip_pending_placeholders(where)

        post: Optional[Callable[[dict], bool]] = None
        if pending:

            def _post(meta: dict) -> bool:
                for p in pending:
                    field = p["field"]
                    sub = str(p.get("substr", "")).lower()
                    mv = str(meta.get(field) or "").lower()
                    if sub not in mv:
                        return False
                return True

            post = _post

        fetch_n = n_results * 4 if post else n_results
        results = embeddings_pipeline_v2.search_chunks(
            query,
            n_results=fetch_n,
            filter_metadata=where if where else None,
            collection_name=self.collection_name,
        )
        if post:
            results = [r for r in results if post(r.get("metadata") or {})][:n_results]
        else:
            results = results[:n_results]
        return results

    def get_available_metadata_values(self, field: str, max_samples: int = 20000) -> list:
        """Distinct values for a metadata field (for UIs)."""
        chroma_f = _chroma_field(field)
        try:
            data = self._collection.get(include=["metadatas"], limit=max_samples)
        except Exception as e:
            logger.warning("get_available_metadata_values: %s", e)
            return []
        metas = data.get("metadatas") or []
        vals: set[str] = set()
        for m in metas:
            if not m:
                continue
            v = m.get(chroma_f)
            if v is not None and str(v).strip():
                vals.add(str(v))
        return sorted(vals)

def example_filter_queries(mf: MetadataFilter) -> None:
    """Print example searches: easy Python exercises, medium-hard course, last month, overview."""
    print("\n=== Example filter queries ===\n")

    # Example 1: easy + chunk_type exercise + language en (Python implied via query)
    q1 = "Python exercises"
    f1 = mf.combine_filters(
        [
            mf.filter_by_difficulty("easy"),
            mf.filter_by_chunk_type("exercise"),
        ],
        "AND",
    )
    r1 = mf.search_with_filters(q1, mf.build_filter({"difficulty": "easy", "chunk_type": "exercise"}), n_results=20)
    print(f'Example 1 — easy exercises: query="{q1}"')
    print(f"  Filter: {f1}")
    print(f"  Results: {len(r1)} chunks")

    # Example 2: medium + hard from a course (use first course_id from DB if any)
    courses = mf.get_available_metadata_values("course_id")
    cid = courses[0] if courses else "python_101"
    f2 = mf.combine_filters(
        [
            mf.filter_by_difficulty(["medium", "hard"]),
            mf.filter_by_course(cid),
        ],
        "AND",
    )
    r2 = mf.search_with_filters("programming", f2, n_results=20)
    print(f'\nExample 2 — medium/hard from course "{cid}"')
    print(f"  Filter: {f2}")
    print(f"  Results: {len(r2)} chunks")

    # Example 3: last month by date_created
    end = datetime.now(timezone.utc)
    start = end - timedelta(days=30)
    f3 = mf.filter_by_date_range(
        start_date=start.strftime("%Y-%m-%d"),
        end_date=end.strftime("%Y-%m-%d"),
    )
    r3 = mf.search_with_filters("lesson", f3, n_results=20) if f3 else []
    print("\nExample 3 — content in last month (date_created range)")
    print(f"  Filter: {f3}")
    print(f"  Results: {len(r3)} chunks")

    # Example 4: overview only
    f4 = mf.filter_by_chunk_type("overview")
    r4 = mf.search_with_filters("course introduction", f4, n_results=20)
    print("\nExample 4 — overview chunks only")
    print(f"  Filter: {f4}")
    print(f"  Results: {len(r4)} chunks")


def _topic_distribution(results: list[dict]) -> dict[str, int]:
    c: Counter[str] = Counter()
    for r in results:
        m = r.get("metadata") or {}
        t = str(m.get("module_name") or m.get("topic") or "unknown")
        c[t] += 1
    return dict(c)


if __name__ == "__main__":
    mf = MetadataFilter()

    print("=== Per-filter helpers ===")
    print("filter_by_difficulty('easy'):", mf.filter_by_difficulty("easy"))
    print("filter_by_course(['a', 'b']):", mf.filter_by_course(["a", "b"]))
    print("filter_by_topic('loops', partial=False):", mf.filter_by_topic("loops"))
    print("filter_by_date_range:", mf.filter_by_date_range("2025-01-01", "2026-12-31"))
    print("filter_by_chunk_type('overview'):", mf.filter_by_chunk_type("overview"))

    print("\n=== combine_filters AND ===")
    cf = mf.combine_filters(
        [mf.filter_by_difficulty("easy"), mf.filter_by_course("python_101")],
        "AND",
    )
    print(cf)

    print("\n=== build_filter (criteria dict) ===")
    bf = mf.build_filter({"difficulty": "easy", "course_id": "python_101"})
    print(bf)

    print("\n=== search_with_filters ===")
    try:
        res = mf.search_with_filters("python loops", bf, n_results=15)
        match = all(
            (r.get("metadata") or {}).get("difficulty") == "easy"
            and (r.get("metadata") or {}).get("course_id") == "python_101"
            for r in res
        ) if res else True
        print(f'Filter: difficulty="easy" AND course_id="python_101"')
        print(f"Results: {len(res)} chunks")
        print(
            "All results match criteria: "
            + ("OK" if match else "NO (metadata may be missing on older chunks)")
        )
    except Exception as ex:
        print(f"search_with_filters skipped: {ex}")

    print("\n=== topic IN + difficulty ne hard ===")
    try:
        topics = ["loops", "functions"]
        topic_clause = {"$or": [{_chroma_field("topic"): {"$eq": t}} for t in topics]}
        comb = mf.combine_filters(
            [topic_clause, {"difficulty": {"$ne": "hard"}}],
            "AND",
        )
        res2 = mf.search_with_filters("code", comb, n_results=30)
        dist = _topic_distribution(res2)
        print(f'Filter: topic IN {topics} AND difficulty != "hard"')
        print(f"Results: {len(res2)} chunks")
        print(f"Topic distribution (module_name): {dist}")
    except Exception as ex:
        print(f"skipped: {ex}")

    print("\n=== get_available_metadata_values ===")
    for fld in ("course_id", "chunk_type", "module_name"):
        vals = mf.get_available_metadata_values(fld)
        print(f"  {fld}: {len(vals)} distinct — sample: {vals[:5]}")

    print("\n=== Helpers: student level & progression & topic text ===")
    print("create_student_level_filter:", create_student_level_filter({"level": "beginner", "weak_areas": ["loops"]}))
    print("create_difficulty_progression('easy'):", create_difficulty_progression_filter("easy"))
    print("create_topic_filter_from_text:", create_topic_filter_from_text("Learn Python loops and functions today"))

    try:
        example_filter_queries(mf)
    except Exception as ex:
        print(f"example_filter_queries: {ex}")
