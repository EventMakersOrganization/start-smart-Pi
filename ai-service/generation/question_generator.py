"""
Question generator - AI-generated level test and adaptive questions via Ollama.
"""
from __future__ import annotations

import difflib
import json
import re
import unicodedata
from typing import Any

from core import config, db_connection
from core.rag_service import RAGService
from utils import langchain_ollama
from . import prompt_templates
from .level_test_quality import reject_level_test_question, topic_slot_aligned

try:
    import ollama as _ollama  # type: ignore
except Exception:  # noqa: BLE001
    _ollama = None

# Default topics per subject when topics is None in generate_multiple_questions
DEFAULT_TOPICS = {
    "Mathematics": "algebra, geometry, calculus, statistics",
    "Physics": "mechanics, waves, thermodynamics, electromagnetism",
    "Programming": "variables, loops, conditionals, functions",
    "General": "general knowledge, reasoning, problem solving",
}

REQUIRED_QUESTION_FIELDS = ["question", "options", "correct_answer", "explanation"]


def _normalize_json_text(text: str) -> str:
    return text.translate(
        str.maketrans(
            {
                "\u201c": '"',
                "\u201d": '"',
                "\u2018": "'",
                "\u2019": "'",
            }
        )
    )


def parse_json_value(response_text: str) -> Any | None:
    if not response_text or not isinstance(response_text, str):
        return None
    text = response_text.strip()
    code_block = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
    if code_block:
        text = code_block.group(1).strip()
    text = _normalize_json_text(text)

    for opener in ("{", "["):
        start = 0
        while True:
            idx = text.find(opener, start)
            if idx < 0:
                break
            try:
                obj, _ = json.JSONDecoder().raw_decode(text, idx)
                return obj if isinstance(obj, (dict, list)) else None
            except json.JSONDecodeError:
                start = idx + 1

    try:
        obj = json.loads(text)
        return obj if isinstance(obj, (dict, list)) else None
    except json.JSONDecodeError:
        return None


def parse_json_response(response_text):
    """
    Extracts JSON from LLM response. Handles markdown code blocks (```json ... ```) or raw {...}.
    Returns parsed JSON (dict or list) or None on failure.
    """
    return parse_json_value(response_text)


def repair_to_strict_json(raw_text: str, *, model_name: str | None = None) -> Any | None:
    if not raw_text or not isinstance(raw_text, str):
        return None
    repair_prompt = (
        "You are a JSON formatter.\n"
        "Rewrite the content below into STRICT JSON ONLY.\n"
        "Rules:\n"
        "- Output ONLY a single JSON value (object or array). No prose, no markdown fences.\n"
        "- Use double quotes for all JSON strings.\n"
        "- Preserve the intended fields for an MCQ: question, options (4 strings), correct_answer, "
        "difficulty, explanation, topic.\n"
        "- correct_answer MUST exactly match one element of options.\n\n"
        "CONTENT TO REFORMAT:\n"
        "---\n"
        f"{raw_text.strip()}\n"
        "---\n\n"
        "JSON:"
    )
    try:
        fixed = _ollama_generate_text(
            prompt=repair_prompt,
            model_name=model_name,
        )
        return parse_json_value(fixed)
    except Exception:
        return None


def _ollama_generate_text(*, prompt: str, model_name: str | None) -> str:
    """
    Generate text using Ollama python client when available.
    Falls back to existing wrapper if `ollama` package is unavailable.
    """
    mn = (model_name or "").strip() or (getattr(config, "OLLAMA_LEVEL_TEST_MODEL", "") or "").strip() or config.OLLAMA_MODEL
    mn = langchain_ollama.resolve_ollama_model_name(mn)
    if _ollama is None:
        # Fallback path: existing wrapper (kept for environments without python `ollama` installed)
        return langchain_ollama.generate_with_model(prompt, mn) if hasattr(langchain_ollama, "generate_with_model") else langchain_ollama.generate_response(prompt)

    opts = {
        "temperature": float(getattr(config, "OLLAMA_LEVEL_TEST_TEMPERATURE", 0.4)),
        "top_p": 0.9,
        "repeat_penalty": float(getattr(config, "OLLAMA_REPEAT_PENALTY", 1.2)),
        "num_ctx": int(getattr(config, "OLLAMA_LEVEL_TEST_NUM_CTX", 2048)),
        "num_predict": int(getattr(config, "OLLAMA_LEVEL_TEST_NUM_PREDICT", 1024)),
    }
    print(
        f"[question_generator] level_test LLM model={mn} "
        f"num_ctx={opts['num_ctx']} num_predict={opts['num_predict']}"
    )
    try:
        resp = _ollama.generate(model=mn, prompt=str(prompt), options=opts)
        if isinstance(resp, dict):
            text = str(resp.get("response", "") or "").strip()
        elif hasattr(resp, "response"):
            text = str(getattr(resp, "response") or "").strip()
        else:
            text = str(resp).strip()
        if text:
            return text
    except Exception:
        # fall through to wrapper fallback below
        pass

    # If Ollama client returned empty (or errored), fall back to existing wrapper.
    return (
        langchain_ollama.generate_with_model(prompt, mn)
        if hasattr(langchain_ollama, "generate_with_model")
        else langchain_ollama.generate_response(prompt)
    )


def _strip_accents(text: str) -> str:
    if not isinstance(text, str):
        return ""
    return "".join(
        c for c in unicodedata.normalize("NFD", text) if unicodedata.category(c) != "Mn"
    )


def canonicalize_correct_answer_in_place(question_dict: dict) -> bool:
    opts = question_dict.get("options")
    if not isinstance(opts, list) or len(opts) != 4:
        return False
    ca = question_dict.get("correct_answer")
    if ca is None or str(ca).strip() == "":
        return False

    ca_s = str(ca).strip()
    letter = re.match(r"^\s*([A-Da-d])\s*$", ca_s)
    if letter:
        i = ord(letter.group(1).upper()) - ord("A")
        if 0 <= i < len(opts):
            question_dict["correct_answer"] = opts[i]
            return True
    num = re.match(r"^\s*([1-4])\s*$", ca_s)
    if num:
        i = int(num.group(1)) - 1
        if 0 <= i < len(opts):
            question_dict["correct_answer"] = opts[i]
            return True

    def norm(s: str) -> str:
        t = _strip_accents(str(s)).lower().strip()
        t = t.strip('"').strip("'").replace("\u2019", "'")
        # Strip common LLM prefixes like "Option A: ", "A) ", "Answer: "
        t = re.sub(r"^(option|choice|answer|reponse)\s*[a-d1-4]?\s*[:\-\)]\s*", "", t)
        t = re.sub(r"^[a-d1-4]\s*[:\-\)]\s*", "", t)
        # Strip trailing punctuation/spaces
        t = re.sub(r"[\s\.,;:\?!]+$", "", t)
        return re.sub(r"\s+", " ", t)

    nca = norm(str(ca))
    pairs: list[tuple[str, str]] = [(norm(str(o)), str(o)) for o in opts]
    for no, raw in pairs:
        if no == nca:
            question_dict["correct_answer"] = raw
            return True
    candidates = [no for no, _ in pairs]
    close = difflib.get_close_matches(nca, candidates, n=1, cutoff=0.8)
    if len(close) == 1:
        for no, raw in pairs:
            if no == close[0]:
                question_dict["correct_answer"] = raw
                return True
    return False


def extract_key_terms(text: str, min_length: int = 4) -> list[str]:
    if not isinstance(text, str):
        return []
    norm = _strip_accents(text).lower()
    tokens = re.findall(r"[a-zA-Z_][a-zA-Z0-9_]*", norm)
    common_words = {
        "le",
        "la",
        "les",
        "un",
        "une",
        "des",
        "de",
        "du",
        "et",
        "ou",
        "en",
        "est",
        "sont",
        "dans",
        "pour",
        "avec",
        "sur",
        "par",
        "au",
        "aux",
        "que",
        "qui",
        "quoi",
        "comme",
        "this",
        "that",
        "with",
        "from",
    }
    terms = [t for t in tokens if len(t) >= min_length and t not in common_words]
    _SHORT_TECH = {
        "for", "while", "do", "if", "else", "switch", "case", "break",
        "return", "int", "char", "float", "tcp", "udp", "ip", "dns",
        "sql", "api", "ram", "rom", "lan", "wan", "ssh", "tls", "ssl",
        "vm", "os", "cpu", "gpu", "nat", "vpc", "iam", "kpi", "wbs",
        "saas", "paas", "iaas", "acid", "crud", "rest", "null",
    }
    for kw in _SHORT_TECH:
        if re.search(rf"\b{kw}\b", norm):
            terms.append(kw)
    out: list[str] = []
    seen: set[str] = set()
    for t in terms:
        if t in seen:
            continue
        seen.add(t)
        out.append(t)
    return out[:20]


def validate_question_quality(
    question_dict: dict,
    course_content: str,
    topic: str | None = None,
    subject: str | None = None,
) -> dict[str, Any]:
    canonicalize_correct_answer_in_place(question_dict)
    issues: list[str] = []

    q_text = _strip_accents(str(question_dict.get("question") or "")).lower().strip()
    options = question_dict.get("options") or []
    options_text = _strip_accents(" ".join(str(x) for x in options)).lower()
    correct_raw = str(question_dict.get("correct_answer") or "")
    correct_norm = _strip_accents(correct_raw).lower().strip()
    topic_norm = _strip_accents(str(topic or "")).lower().strip()
    subject_norm = _strip_accents(str(subject or "")).lower().strip()

    # RULE 1: reject meta-questions that reference chapter/topic names.
    if topic_norm:
        meta_patterns = [
            f"concernant {topic_norm}",
            f"dans {topic_norm}, quelle",
            f"« {topic_norm} »",
            f"le chapitre {topic_norm}",
            f"la notion {topic_norm}",
        ]
        if subject_norm:
            meta_patterns.append(f"dans {subject_norm}")
        for pattern in meta_patterns:
            if pattern in q_text:
                issues.append(f"Question meta-references topic name: '{pattern}'")
                print(f"[question_generator] REJECTED meta-question: {q_text[:120]!r}")
                return {"is_valid": False, "issues": issues}

    # RULE 2: reject circular/meta answers.
    circular_phrases = [
        "correspond a ce qui est presente dans le cours",
        "correspond a ce qui est dans le cours",
        "est presente dans le cours",
        "selon le cours",
        "d'apres le cours",
        "comme indique dans le cours",
    ]
    for phrase in circular_phrases:
        if phrase in correct_norm or phrase in options_text:
            issues.append(f"Circular/meta answer detected: '{phrase}'")
            print(f"[question_generator] REJECTED circular answer: {correct_norm[:120]!r}")
            return {"is_valid": False, "issues": issues}

    # RULE 3: reject vague answers.
    vague_answers = [
        "tous les elements ci-dessus",
        "aucune des reponses",
        "toutes les reponses",
        "option a, b, c",
        "none of the above",
        "all of the above",
    ]
    if any(phrase in correct_norm for phrase in vague_answers):
        issues.append("Answer is too vague")
        return {"is_valid": False, "issues": issues}

    option_norms = [
        _strip_accents(str(x)).lower().strip()
        for x in (question_dict.get("options") or [])
    ]
    # RULE 4: options must be distinct.
    if len(option_norms) != len(set(option_norms)):
        issues.append("Duplicate options")
        return {"is_valid": False, "issues": issues}
    if len(set(option_norms)) < 3:
        issues.append("Options are not distinct enough.")

    # RULE 5: correct answer must appear in options.
    if correct_norm and option_norms:
        if correct_norm not in option_norms:
            issues.append("Correct answer not in options")
            return {"is_valid": False, "issues": issues}

    # Keep existing hard rejection patterns from quality module.
    r = reject_level_test_question(
        question_dict, slot_topic=topic, course_context=course_content, require_french=True
    )
    if r:
        issues.append(f"Rejected pattern: {r}")
        return {"is_valid": False, "issues": issues}

    # RULE 6: options must be specific enough.
    for i, opt in enumerate(options):
        if len(str(opt).strip()) < 5:
            issues.append(f"Option {i + 1} too short: '{opt}'")

    # RULE 7 removed: content-vocabulary overlap was too strict and rejected many valid questions.

    # RULE 8: minimum length for meaningful question.
    if len(q_text) < 20:
        issues.append("Question too short")

    # Keep topic alignment check.
    if topic_norm:
        topic_aligned = topic_slot_aligned(question_dict, topic_norm, course_content)
        if not topic_aligned:
            issues.append("Question does not align with the target topic.")

    if correct_norm and option_norms:
        def _trim_trivial(s: str) -> str:
            return s.strip().strip('"').strip("'")

        cn = _trim_trivial(correct_norm)
        exact = any(_trim_trivial(opt) == cn for opt in option_norms)
        if not exact:
            ok = False
            for opt in option_norms:
                on = _trim_trivial(opt)
                if on.startswith(cn):
                    extra = on[len(cn):].strip()
                    if not extra or all(ch in ";,." for ch in extra):
                        ok = True
                        break
            if not ok:
                issues.append("Correct answer does not exactly match any option text.")

    if issues:
        print(f"[question_generator] validate_question_quality issues: {issues}")
        return {"is_valid": False, "issues": issues}
    print(f"[question_generator] Question passed validation: {q_text[:80]!r}")
    return {"is_valid": True, "issues": []}


def _generate_level_test_llm(prompt: str) -> str:
    primary = (getattr(config, "OLLAMA_LEVEL_TEST_MODEL", "") or "").strip() or config.OLLAMA_MODEL
    text = _ollama_generate_text(prompt=prompt, model_name=primary)
    if text:
        return text
    return ""


def validate_question(question_dict):
    """
    Checks if question has all required fields: question, options, correct_answer, explanation.
    options must be a list (ideally of 4 items).
    Returns True if valid, False otherwise.
    """
    if not question_dict or not isinstance(question_dict, dict):
        return False
    if "explanation" not in question_dict:
        question_dict["explanation"] = ""
    for key in REQUIRED_QUESTION_FIELDS:
        if key not in question_dict:
            return False
    if not isinstance(question_dict.get("options"), list):
        return False
    if not isinstance(question_dict.get("question"), str) or not question_dict["question"].strip():
        return False
    return True


def generate_level_test_question(
    subject,
    difficulty="medium",
    topic="general",
    *,
    diversity_seed: str | None = None,
    course_ids: list[str] | None = None,
    previous_questions: list[str] | None = None,
):
    """
    Generates a single level test question using the prompt template and Ollama LLM.
    Parses JSON, validates, retries once on failure.
    Returns question dict {question, options, correct_answer, explanation} or None.
    """
    rag_service = RAGService.get_instance()
    context_query = f"{subject} {topic}".strip()
    cids = [str(x).strip() for x in (course_ids or []) if str(x).strip()]
    if cids and hasattr(rag_service, "get_context_for_course_ids"):
        course_content = rag_service.get_context_for_course_ids(
            context_query, cids, max_chunks=8
        )
        if not (course_content or "").strip():
            course_content = rag_service.get_context_for_course_ids(
                subject, cids, max_chunks=8
            )
    else:
        course_content = rag_service.get_context_for_query(context_query, max_chunks=3)
    if not course_content or len(course_content) < 50:
        if cids and hasattr(rag_service, "get_context_for_course_ids"):
            # Strict filtered mode: never fall back to global query when course_ids are provided.
            course_content = rag_service.get_context_for_course_ids(
                subject, cids, max_chunks=10
            )
        else:
            if not course_content or len(course_content) < 50:
                course_content = rag_service.get_context_for_query(context_query, max_chunks=5)
            if not course_content or len(course_content) < 50:
                course_content = rag_service.get_context_for_query(subject, max_chunks=5)
    course_content = (course_content or "").strip()
    # Keep within small-model context limits (ctx is typically 2048–4096).
    if len(course_content) > 2800:
        course_content = course_content[:2800]

    prev_q = previous_questions or []
    prev_blob = "\n".join(f"- {str(x)[:120]}" for x in prev_q[:10]) or "- (aucune)"
    prompt = f"""Tu es un professeur qui crée une question d'examen pour tester les connaissances.

LANGUE: Français UNIQUEMENT. Toute la question et toutes les réponses DOIVENT être en français.

MATIÈRE: {subject}
SUJET SPÉCIFIQUE: {topic}
DIFFICULTÉ: {difficulty}

CONTENU DU COURS (BASE tes questions sur CE CONTENU):
{course_content[:1800]}

QUESTIONS DÉJÀ POSÉES (NE PAS RÉPÉTER):
{prev_blob}

RÈGLES ABSOLUES:
1. Question et réponses 100% en FRANÇAIS
2. La question DOIT tester une CONNAISSANCE SPÉCIFIQUE du contenu ci-dessus
3. La question DOIT être en rapport direct avec "{topic}" — utilise le vocabulaire du sujet dans ta question
4. NE PAS créer de questions génériques comme "Dans {topic}, quelle pratique..."
5. NE PAS mentionner le nom du chapitre dans la question
6. Options DISTINCTES et SPÉCIFIQUES (pas "Étape 1, Étape 2...")
7. UNE SEULE réponse correcte qui correspond EXACTEMENT à une des 4 options
8. correct_answer DOIT être le texte EXACT d'une option, pas une lettre

FRANÇAIS UNIQUEMENT. Réponds UNIQUEMENT avec le JSON, rien d'autre:
{{
  "question": "...",
  "options": ["...", "...", "...", "..."],
  "correct_answer": "...",
  "difficulty": "{difficulty}",
  "topic": "{topic}"
}}
"""
    if diversity_seed:
        prompt += (
            "\n\nSESSION / DIVERSITY: "
            + str(diversity_seed).strip()
            + "\nVarie les angles et exemples, sans sortir du contenu fourni."
        )

    invalid_json_count = 0

    def _normalize_generated_mcq(raw: dict[str, Any]) -> dict[str, Any] | None:
        if not isinstance(raw, dict):
            return None
        qtxt = str(raw.get("question") or raw.get("questionText") or "").strip()
        options_raw = raw.get("options")
        options: list[str] = []
        if isinstance(options_raw, dict):
            options = [str(options_raw.get(k, "")).strip() for k in ("A", "B", "C", "D")]
            options = [o for o in options if o]
        elif isinstance(options_raw, list):
            options = [str(x).strip() for x in options_raw if str(x).strip()]
            if len(options) == 4:
                options = [re.sub(r"^[A-Da-d]\s*[\)\.\-:]\s*", "", o).strip() for o in options]
        if len(options) != 4:
            return None
        corr = str(raw.get("correct_answer") or raw.get("correctAnswer") or "").strip()
        if re.fullmatch(r"[A-Da-d]", corr):
            corr = options[ord(corr.upper()) - ord("A")]
        corr = re.sub(r"^[A-Da-d]\s*[\)\.\-:]\s*", "", corr).strip()
        out = {
            "question": qtxt,
            "questionText": qtxt,
            "options": options,
            "correct_answer": corr,
            "correctAnswer": corr,
            "difficulty": str(raw.get("difficulty") or difficulty).strip().lower() or difficulty,
            "topic": str(raw.get("topic") or topic).strip() or topic,
            "explanation": str(raw.get("explanation") or "").strip(),
        }
        if not out["explanation"]:
            out["explanation"] = "Réponse justifiée par le contenu fourni."
        return out
    llm_attempts = max(1, int(getattr(config, "LEVEL_TEST_LLM_ATTEMPTS", 1)))
    for attempt in range(llm_attempts):
        try:
            strict_suffix = ""
            if attempt >= 1:
                strict_suffix = "\nSTRICT MODE: Return JSON only. Do not output prose."
            final_prompt = prompt + strict_suffix
            print(
                f"[question_generator] generate_level_test_question attempt {attempt + 1}: "
                f"subject={subject}, difficulty={difficulty}, topic={topic}"
            )
            response = _generate_level_test_llm(final_prompt)
            if not response or not str(response).strip():
                print("[question_generator] Empty LLM response; retrying...")
                continue
            data = parse_json_response(response)
            if isinstance(data, list):
                dict_items = [x for x in data if isinstance(x, dict)]
                data = dict_items[0] if dict_items else None

            if data is None or not isinstance(data, dict):
                snippet = (response or "").strip().replace("\n", " ")[:220]
                print(f"[question_generator] Invalid JSON in response, retrying... snippet={snippet!r}")
                invalid_json_count += 1
                repaired = repair_to_strict_json(
                    response,
                    model_name=getattr(config, "OLLAMA_LEVEL_TEST_MODEL", None),
                )
                if repaired is not None:
                    if isinstance(repaired, list):
                        dict_items = [x for x in repaired if isinstance(x, dict)]
                        data = dict_items[0] if dict_items else None
                    else:
                        data = repaired
                else:
                    if invalid_json_count >= 2:
                        continue
                continue
            data = _normalize_generated_mcq(data)
            if data is None:
                continue
            if not validate_question(data):
                print(
                    "[question_generator] Generated JSON missing required fields; "
                    f"keys={sorted(list(data.keys()))}"
                )
                continue

            quality = validate_question_quality(
                data,
                course_content,
                topic=topic,
                subject=subject,
            )
            if quality.get("is_valid") and prev_q:
                n_new = _strip_accents(data.get("question", "")).lower()
                for old in prev_q:
                    n_old = _strip_accents(str(old)).lower()
                    if n_old and (n_old in n_new or n_new in n_old):
                        quality = {"is_valid": False, "issues": ["Too similar to previous questions"]}
                        break
            if quality.get("is_valid"):
                return data
            reasons = quality.get('issues', ['unknown'])
            print(f"[question_generator] Question failed validation: {reasons}; retrying...")
        except Exception as e:
            print(f"[question_generator] generate_level_test_question error: {e}")
    return None


def generate_multiple_questions(subject, difficulty="medium", num_questions=5, topics=None):
    """
    Generates multiple questions in one call using get_multiple_questions_prompt.
    If topics is None, uses default topics for the subject.
    Returns list of question dicts.
    """
    if topics is None:
        topics = DEFAULT_TOPICS.get(subject, DEFAULT_TOPICS["General"])
    topics_str = topics if isinstance(topics, str) else ", ".join(str(t) for t in topics)
    prompt = prompt_templates.get_multiple_questions_prompt(subject, difficulty, num_questions, topics_str)
    try:
        print(f"[question_generator] generate_multiple_questions: subject={subject}, n={num_questions}")
        response = langchain_ollama.generate_fast(prompt)
        if not response:
            return []
        data = parse_json_response(response)
        if data is None:
            print("[question_generator] Failed to parse JSON from multiple-questions response.")
            return []
        if not isinstance(data, list):
            data = [data] if isinstance(data, dict) else []
        result = []
        for i, item in enumerate(data):
            if isinstance(item, dict) and validate_question(item):
                result.append(item)
            else:
                print(f"[question_generator] Skipping invalid question at index {i}")
        return result
    except Exception as e:
        print(f"[question_generator] generate_multiple_questions error: {e}")
        return []


def _difficulty_from_scores(previous_scores):
    """Maps average score to difficulty: low -> hard, medium -> medium, high -> easy."""
    if not previous_scores:
        return "medium"
    try:
        nums = [float(x) for x in previous_scores if x is not None]
        if not nums:
            return "medium"
        avg = sum(nums) / len(nums)
        if avg < 50:
            return "easy"
        if avg > 75:
            return "hard"
        return "medium"
    except (TypeError, ValueError):
        return "medium"


def generate_adaptive_question(subject, student_profile):
    """
    Generates a personalized question based on student_profile.
    student_profile: dict with weak_areas, current_level, previous_scores.
    Determines difficulty from performance and uses get_adaptive_question_prompt.
    Returns question dict or None.
    """
    profile = student_profile or {}
    weak_areas = profile.get("weak_areas", "general")
    if isinstance(weak_areas, list):
        weak_areas = ", ".join(str(x) for x in weak_areas)
    previous_scores = profile.get("previous_scores", [])
    difficulty = _difficulty_from_scores(previous_scores)
    previous_performance = f"Current level: {profile.get('current_level', 'unknown')}. Previous scores: {previous_scores}"
    prompt = prompt_templates.get_adaptive_question_prompt(subject, weak_areas, difficulty, previous_performance)
    try:
        print(f"[question_generator] generate_adaptive_question: subject={subject}, difficulty={difficulty}")
        response = langchain_ollama.generate_response(prompt)
        if not response:
            return None
        data = parse_json_response(response)
        if isinstance(data, list) and len(data) > 0:
            data = data[0]
        if isinstance(data, dict) and validate_question(data):
            return data
        return None
    except Exception as e:
        print(f"[question_generator] generate_adaptive_question error: {e}")
        return None


def save_question_to_db(question_dict, course_id, source="AI"):
    """
    Saves question to MongoDB 'exercises' collection.
    Fields: courseId, difficulty, content (question text), correctAnswer, type="MCQ", source, options, explanation.
    Returns saved question ID (string) or None.
    """
    if not question_dict or not validate_question(question_dict):
        print("[question_generator] save_question_to_db: invalid question dict.")
        return None
    try:
        doc = {
            "courseId": course_id,
            "difficulty": question_dict.get("difficulty", "medium"),
            "content": question_dict.get("question", ""),
            "correctAnswer": question_dict.get("correct_answer", ""),
            "type": "MCQ",
            "source": source,
            "options": question_dict.get("options", []),
            "explanation": question_dict.get("explanation", ""),
        }
        inserted_id = db_connection.insert_exercise(doc)
        return inserted_id
    except Exception as e:
        print(f"[question_generator] save_question_to_db error: {e}")
        return None


def generate_and_save_level_test(subject, num_questions=10, course_id="level-test"):
    """
    Generates a complete level test: 3 easy, 4 medium, 3 hard (or proportional).
    Saves all questions to the database and returns list of question IDs.
    """
    n = max(1, num_questions)
    n_easy = max(0, (n * 3) // 10)
    n_hard = max(0, (n * 3) // 10)
    n_medium = n - n_easy - n_hard
    if n_medium < 0:
        n_medium = 0
        n_easy = n // 2
        n_hard = n - n_easy
    counts = [("easy", n_easy), ("medium", n_medium), ("hard", n_hard)]
    all_ids = []
    total = 0
    for difficulty, count in counts:
        if count <= 0:
            continue
        print(f"[question_generator] Generating {count} {difficulty} questions...")
        questions = generate_multiple_questions(subject, difficulty=difficulty, num_questions=count, topics=None)
        for i, q in enumerate(questions):
            q["difficulty"] = difficulty
            qid = save_question_to_db(q, course_id, source="AI")
            if qid:
                all_ids.append(qid)
                total += 1
                print(f"[question_generator] Saved question {total}/{n}: id={qid}")
    print(f"[question_generator] generate_and_save_level_test: saved {len(all_ids)} questions.")
    return all_ids


if __name__ == "__main__":
    print("=== Question generator tests ===\n")

    print("1. parse_json_response (markdown):")
    s = 'Here is the answer:\n```json\n{"question": "Q?", "options": ["A","B","C","D"], "correct_answer": "A", "explanation": "E"}\n```'
    out = parse_json_response(s)
    print("   Valid:", validate_question(out) if isinstance(out, dict) else False)

    print("\n2. generate_level_test_question (single):")
    q = generate_level_test_question("Mathematics", "easy", "algebra")
    if q:
        print("   Question:", q.get("question", "")[:60] + "...")
        print("   Options:", len(q.get("options", [])))
    else:
        print("   (Skipped or failed - Ollama may not be running)")

    print("\n3. validate_question:")
    print("   Valid dict:", validate_question({"question": "Q?", "options": ["A","B","C","D"], "correct_answer": "A", "explanation": "E"}))
    print("   Missing field:", validate_question({"question": "Q?", "options": []}))

    print("\nDone.")
