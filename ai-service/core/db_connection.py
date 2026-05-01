"""
Database connection module - MongoDB client and course access helpers.
"""
from bson import ObjectId

try:
    from pymongo import MongoClient
    from pymongo.errors import PyMongoError
except ImportError:
    raise ImportError("pymongo is required. Install with: pip install pymongo")

from . import config


def _doc_to_dict(doc):
    """Convert MongoDB document to dict with ObjectId as string."""
    if doc is None:
        return None
    d = dict(doc)
    if "_id" in d:
        d["id"] = str(d["_id"])
        del d["_id"]
    return d


# Create MongoClient and get database
try:
    _client = MongoClient(config.MONGODB_URI)
    _db = _client[config.MONGODB_DB_NAME]
    _courses = _db["courses"]
    _exercises = _db["exercises"]
    _subjects = _db["subjects"]
except PyMongoError as e:
    _client = None
    _db = None
    _courses = None
    _exercises = None
    _subjects = None
    print(f"[db_connection] Warning: Could not connect to MongoDB: {e}")


def get_database():
    """Return the shared MongoDB database instance."""
    if _db is None:
        raise RuntimeError("MongoDB database not initialised (check connection settings).")
    return _db


def get_all_courses():
    """
    Returns all documents from the 'courses' collection.
    Returns a list of dictionaries with ObjectId converted to string for JSON compatibility.

    Each course may include MongoDB fields such as:
    title, description, level, subChapters, subject (logical subject / programme name), etc.
    """
    try:
        if _courses is None:
            print("[db_connection] Error: Database not initialized.")
            return []
        cursor = _courses.find({})
        result = [_doc_to_dict(doc) for doc in cursor]
        print(f"[db_connection] get_all_courses: returned {len(result)} course(s).")
        return result
    except PyMongoError as e:
        print(f"[db_connection] get_all_courses error: {e}")
        return []


def get_course_by_id(course_id):
    """
    Returns a single course document by id.
    course_id: string (will be matched against _id).
    Returns dict with ObjectId as string, or None if not found.
    """
    try:
        if _courses is None:
            print("[db_connection] Error: Database not initialized.")
            return None
        if not course_id:
            print("[db_connection] get_course_by_id: course_id is empty.")
            return None
        try:
            oid = ObjectId(course_id)
        except Exception:
            print(f"[db_connection] get_course_by_id: invalid ObjectId '{course_id}'.")
            return None
        doc = _courses.find_one({"_id": oid})
        result = _doc_to_dict(doc)
        if result is None:
            print(f"[db_connection] get_course_by_id: no course found for id '{course_id}'.")
        else:
            print(f"[db_connection] get_course_by_id: found course '{result.get('title', '')}'.")
        return result
    except PyMongoError as e:
        print(f"[db_connection] get_course_by_id error: {e}")
        return None


def get_all_subjects():
    """
    Returns all documents from the 'subjects' collection.
    Each subject has: title, code, chapters[].subChapters[] hierarchy.
    """
    try:
        if _subjects is None:
            print("[db_connection] Error: Database not initialized (subjects).")
            return []
        cursor = _subjects.find({})
        result = [_doc_to_dict(doc) for doc in cursor]
        print(f"[db_connection] get_all_subjects: returned {len(result)} subject(s).")
        return result
    except PyMongoError as e:
        print(f"[db_connection] get_all_subjects error: {e}")
        return []


def get_subject_by_id(subject_id):
    """
    Returns a single subject document by _id.
    """
    try:
        if _subjects is None:
            print("[db_connection] Error: Database not initialized (subjects).")
            return None
        if not subject_id:
            return None
        try:
            oid = ObjectId(subject_id)
        except Exception:
            print(f"[db_connection] get_subject_by_id: invalid ObjectId '{subject_id}'.")
            return None
        doc = _subjects.find_one({"_id": oid})
        return _doc_to_dict(doc)
    except PyMongoError as e:
        print(f"[db_connection] get_subject_by_id error: {e}")
        return None


def get_subject_by_title(title):
    """
    Returns a subject document matching the given title (case-insensitive).
    """
    try:
        if _subjects is None:
            return None
        if not title:
            return None
        import re as _re
        doc = _subjects.find_one({"title": _re.compile(f"^{_re.escape(title.strip())}$", _re.IGNORECASE)})
        return _doc_to_dict(doc)
    except PyMongoError as e:
        print(f"[db_connection] get_subject_by_title error: {e}")
        return None


def insert_course(course_doc):
    """
    Inserts a course document into the 'courses' collection.
    course_doc: dict with title, description, subChapters, level, etc.
    If course_doc has 'course_id' or 'id', uses it as _id when valid ObjectId.
    Returns the inserted document id (string).
    """
    try:
        if _courses is None:
            print("[db_connection] Error: Database not initialized.")
            return None
        doc = dict(course_doc)
        cid = doc.pop("course_id", None) or doc.pop("id", None)
        if cid:
            try:
                doc["_id"] = ObjectId(cid)
            except Exception:
                pass
        result = _courses.insert_one(doc)
        inserted_id = str(result.inserted_id)
        print(f"[db_connection] insert_course: inserted id={inserted_id}")
        return inserted_id
    except PyMongoError as e:
        print(f"[db_connection] insert_course error: {e}")
        return None


def insert_exercise(exercise_doc):
    """
    Inserts an exercise document into the 'exercises' collection.
    Returns the inserted document id (string).
    """
    try:
        if _exercises is None:
            print("[db_connection] Error: Database not initialized.")
            return None
        result = _exercises.insert_one(dict(exercise_doc))
        inserted_id = str(result.inserted_id)
        print(f"[db_connection] insert_exercise: inserted id={inserted_id}")
        return inserted_id
    except PyMongoError as e:
        print(f"[db_connection] insert_exercise error: {e}")
        return None


def test_connection():
    """
    Tests if MongoDB connection works.
    Prints number of courses and first course as example.
    Returns True if successful, False otherwise.
    """
    try:
        if _client is None or _db is None or _courses is None:
            print("[db_connection] test_connection: Database not initialized.")
            return False
        _client.admin.command("ping")
        print("[db_connection] test_connection: MongoDB ping OK.")
        count = _courses.count_documents({})
        print(f"[db_connection] test_connection: Number of courses in database: {count}")
        first = _courses.find_one({})
        if first:
            print("[db_connection] test_connection: First course (example):")
            example = _doc_to_dict(first)
            for k, v in example.items():
                print(f"  {k}: {v}")
        else:
            print("[db_connection] test_connection: No courses in collection.")
        print("[db_connection] test_connection: Success.")
        return True
    except PyMongoError as e:
        print(f"[db_connection] test_connection failed: {e}")
        return False


if __name__ == "__main__":
    print("Running MongoDB connection test...")
    success = test_connection()
    print("Test result:", "PASSED" if success else "FAILED")
