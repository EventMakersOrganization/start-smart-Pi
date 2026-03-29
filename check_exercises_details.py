from pymongo import MongoClient
import json

db = MongoClient('mongodb://localhost:27017/')['user-management']
col = db['exercises']

# Get a few examples
examples = list(col.find().limit(3))
print('Sample exercises:')
for i, ex in enumerate(examples):
    print(f'\n--- Exercise {i+1} ---')
    print(f'ID: {ex.get("_id")}')
    print(f'Course: {ex.get("course_id")}')
    print(f'Original ID: {ex.get("original_id")}')
    print(f'Question: {ex.get("question", "")[:100]}...')
    print(f'Options: {ex.get("options", [])}')
    print(f'Correct: {ex.get("correct_answer")}')

# Check how many have course_id set
with_course = col.count_documents({'course_id': {'$exists': True, '$ne': None}})
without_course = col.count_documents({'course_id': {'$exists': False}}) + col.count_documents({'course_id': None})

print(f'\n\nWith course_id: {with_course}')
print(f'Without course_id: {without_course}')
