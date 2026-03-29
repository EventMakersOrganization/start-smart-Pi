import sys
sys.path.insert(0, 'ai-service')

from core.db_connection import get_all_courses
from level_test.real_exercise_loader import get_questions_for_course

courses = get_all_courses()
print(f"Total chapters: {len(courses)}")
for c in courses:
    cid = c.get('id')
    title = c.get('title', '')
    qs = get_questions_for_course(cid, num_questions=1000, difficulty=None)
    print(f"{title}: {len(qs)} valid unique real questions")
