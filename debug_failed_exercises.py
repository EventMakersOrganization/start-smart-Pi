import sys
from pathlib import Path

_SERVICE_ROOT = Path(__file__).resolve().parent / "ai-service"
if str(_SERVICE_ROOT) not in sys.path:
    sys.path.insert(0, str(_SERVICE_ROOT))

from level_test.real_exercise_loader import (
    get_all_exercises,
    adapt_exercise_to_question,
    _is_multi_question_blob,
    _clean_question_text,
    _clean_options,
    _resolve_correct_answer,
    _is_complete_prompt,
    _has_basic_question_option_coherence,
)

exercises = get_all_exercises()

print('Examining failed exercises...\n')
failed_count = 0

for ex in exercises[:15]:  # Check first 15
    raw_content = str(ex.get("content", ""))
    
    if _is_multi_question_blob(raw_content):
        print(f'FAIL MULTI-QUESTION: {raw_content[:50]}...')
        continue
    
    question_text = _clean_question_text(raw_content)
    options = _clean_options(ex.get("options", []))
    correct_answer = _resolve_correct_answer(options, str(ex.get("correctAnswer", "")))
    
    reasons = []
    if not question_text or len(question_text) < 12:
        reasons.append(f"short_q ({len(question_text)})")
    if len(options) < 2:
        reasons.append(f"few_opts ({len(options)})")
    if not correct_answer:
        reasons.append("no_answer")
    if not _is_complete_prompt(question_text):
        reasons.append("incomplete")
    if not _has_basic_question_option_coherence(question_text, options):
        reasons.append("incoherent")
    
    if reasons:
        failed_count += 1
        print(f'FAIL: {", ".join(reasons)}')
        print(f'   Q: {question_text[:80]}')
        print(f'   Opts: {options[:2]}')
        print()
    else:
        print(f'PASS: {question_text[:50]}...')

print(f'\nThese 15 exercises: {15-failed_count} valid, {failed_count} failed')
