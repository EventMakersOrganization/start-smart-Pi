from pymongo import MongoClient

def main():
    uri = "mongodb://127.0.0.1:27017/user-management"
    try:
        client = MongoClient(uri, serverSelectionTimeoutMS=5000)
        db = client['user-management']
        collection = db['studentprofiles']

        print("Fetching indexes...")
        indexes = collection.list_indexes()
        index_names = [idx['name'] for idx in indexes]
        print(f"Current indexes: {index_names}")

        target = "user_1"
        if target in index_names:
            print(f"Found {target}. Dropping...")
            collection.drop_index(target)
            print("Successfully dropped!")
        else:
            print(f"Index {target} not found.")

    except Exception as e:
        print(f"Error: {e}")
    finally:
        if 'client' in locals():
            client.close()

if __name__ == "__main__":
    main()
