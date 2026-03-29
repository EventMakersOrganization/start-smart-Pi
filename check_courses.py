import sys
sys.path.insert(0, 'ai-service')

from core.db_connection import get_all_courses

courses = get_all_courses()
print(f'Total courses: {len(courses)}')
print()

for i, c in enumerate(courses, 1):
    print(f'{i}. {c.get("title")}')

print()
print(f'CALCULATION: {len(courses)} courses × 5 questions = {len(courses) * 5} questions')
