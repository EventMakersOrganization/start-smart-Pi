import sys
from pathlib import Path

_SERVICE_ROOT = Path(__file__).resolve().parent / "ai-service"
if str(_SERVICE_ROOT) not in sys.path:
    sys.path.insert(0, str(_SERVICE_ROOT))

from level_test.real_exercise_loader import (
    get_all_exercises,
    adapt_exercise_to_question,
)

exercises = get_all_exercises()
print(f'Total exercises in DB: {len(exercises)}')
print()

adapted = []
failed = {'multi_question': 0, 'short_question': 0, 'few_options': 0, 'no_answer': 0, 'incomplete': 0, 'incoherent': 0, 'unknown': 0}

for i, ex in enumerate(exercises):
    result = adapt_exercise_to_question(ex)
    if result:
        adapted.append(result)
    else:
        # Try to figure out why it failed
        content = str(ex.get("content", ""))
        if "question" in content.lower() and content.count("?") > 1:
            failed['multi_question'] += 1
        elif len(content) < 20:
            failed['short_question'] += 1
        elif len(ex.get("options", [])) < 2:
            failed['few_options'] += 1
        elif not ex.get("correctAnswer"):
            failed['no_answer'] += 1
        else:
            failed['unknown'] += 1

print(f'Successfully adapted: {len(adapted)} ({100*len(adapted)/len(exercises):.1f}%)')
print()
print('Failed reasons:')
for reason, count in sorted(failed.items(), key=lambda x: -x[1]):
    if count > 0:
        print(f'  {reason}: {count}')

print()
print(f'Real questions available: {len(adapted)}')
print(f'Needed per subject (5): {5}')
print(f'For 7 subjects (35 total): Can cover? {len(adapted) >= 35}')
print()

# Sample adapted question
if adapted:
    print('Sample adapted question:')
    q = adapted[0]
    print(f"  Q: {q.get('question', '')[:80]}...")
    print(f"  Options: {len(q.get('options', []))} choices")
    print(f"  Difficulty: {q.get('difficulty')}")
    print(f"  Original ID: {q.get('original_id')}")
