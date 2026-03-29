from pymongo import MongoClient

db = MongoClient('mongodb://localhost:27017/')['user-management']
col = db['exercises']

# Get ONE full exercise
ex = col.find_one({})
print('Full exercise document:')
print(f'Keys: {list(ex.keys())}')
print()

for key in ex.keys():
    val = ex[key]
    if isinstance(val, str):
        print(f'{key}: {val[:200]}...' if len(str(val)) > 200 else f'{key}: {val}')
    elif isinstance(val, list):
        print(f'{key}: (list of {len(val)} items)')
        if len(val) > 0 and isinstance(val[0], str):
            print(f'  First: {val[0][:100]}...')
    else:
        print(f'{key}: {val}')
