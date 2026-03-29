import sys
from pathlib import Path
from bson import ObjectId

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / "ai-service"))

from core.db_connection import get_database, get_all_courses
from level_test.real_exercise_loader import (
    adapt_exercise_to_question,
    _is_multi_question_blob,
    _clean_question_text,
    _clean_options,
    _resolve_correct_answer,
    _is_complete_prompt,
    _has_basic_question_option_coherence,
)


def check_reason(ex):
    raw_content = str(ex.get("content", ""))
    if _is_multi_question_blob(raw_content):
        return "multi_question"
    question_text = _clean_question_text(raw_content)
    options = _clean_options(ex.get("options", []))
    correct_answer = _resolve_correct_answer(options, str(ex.get("correctAnswer", "")))
    if not question_text or len(question_text) < 12:
        return "short_question"
    if len(options) < 3:
        return "few_options"
    if not correct_answer:
        return "missing_correct"
    low = question_text.lower()
    is_output_q = any(k in low for k in ["quelle est la sortie", "que va-t-il s'afficher", "what is the output"])
    if is_output_q:
        import re
        if not re.search(r"[{};]|\d+|printf|cout|return|if|for|while|switch", question_text):
            return "output_without_code"
    elif not _is_complete_prompt(question_text):
        return "incomplete_prompt"
    if not _has_basic_question_option_coherence(question_text, options):
        return "incoherent_options"
    return "ok"


def main():
    db = get_database()
    ex_col = db["exercises"]

    for c in get_all_courses():
        cid = c.get("id")
        title = c.get("title", "")
        cid_obj = ObjectId(cid) if ObjectId.is_valid(str(cid)) else cid

        all_ex = list(ex_col.find({"courseId": cid_obj}))
        valid = 0
        bad = []
        for ex in all_ex:
            reason = check_reason(ex)
            if reason == "ok":
                valid += 1
            else:
                bad.append((reason, ex.get("content", "")[:100]))

        if valid < 5:
            print(f"\n{title} -> valid={valid}, total={len(all_ex)}")
            reasons = {}
            for r, _ in bad:
                reasons[r] = reasons.get(r, 0) + 1
            print("Reasons:", reasons)
            for r, txt in bad[:5]:
                print(f"  - {r}: {txt}")


if __name__ == "__main__":
    main()
