from pymongo import MongoClient

db = MongoClient('mongodb://localhost:27017/')['user-management']
col = db['exercises']

total = col.count_documents({})
print(f'Total exercises in database: {total}')
print()

# Count by course_id
agg = list(col.aggregate([
    {'$group': {'_id': '$course_id', 'count': {'$sum': 1}}},
    {'$sort': {'count': -1}}
]))

print('Exercises per course:')
for doc in agg:
    course_id = doc['_id'] or 'None'
    count = doc['count']
    print(f'  {course_id}: {count} exercises')

print()
print('Sample question (first one):')
sample = col.find_one({})
if sample:
    print(f"  Course: {sample.get('course_id')}")
    print(f"  Question: {str(sample.get('question', ''))[:100]}...")
    print(f"  Has original_id: {bool(sample.get('original_id'))}")
    print(f"  Has options: {len(sample.get('options', []))} options")
