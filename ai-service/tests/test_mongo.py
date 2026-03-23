from pymongo import MongoClient

client = MongoClient("mongodb://localhost:27017")

db = client["startsmart"]

print("Connected to LOCAL MongoDB successfully!")