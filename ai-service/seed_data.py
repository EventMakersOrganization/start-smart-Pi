"""
Seed script: populates MongoDB with sample courses and exercises for first-year students.
Run from ai-service: python seed_data.py
"""
from bson import ObjectId

from core import config

try:
    from pymongo import MongoClient
    from pymongo.errors import PyMongoError
except ImportError:
    raise ImportError("pymongo is required. Install with: pip install pymongo")


def get_db():
    client = MongoClient(config.MONGODB_URI)
    return client[config.MONGODB_DB_NAME]


# ---------------------------------------------------------------------------
# Sample courses (10) for first-year students
# ---------------------------------------------------------------------------
SAMPLE_COURSES = [
    {
        "title": "Introduction to Programming with Python",
        "description": "Learn Python basics including variables, loops, functions, and object-oriented programming. Perfect for first-year students with no prior coding experience.",
        "subChapters": ["Variables and Data Types", "Control Structures", "Functions", "OOP Basics"],
        "level": "Beginner",
        "instructorId": "instructor_001",
    },
    {
        "title": "Mathematics for Computer Science",
        "description": "Essential mathematics for first-year CS students: sets, logic, discrete math, and basic linear algebra. Covers foundations needed for algorithms and data structures.",
        "subChapters": ["Sets and Logic", "Proofs and Induction", "Combinatorics", "Matrices"],
        "level": "Beginner",
        "instructorId": "instructor_001",
    },
    {
        "title": "Physics I: Mechanics and Waves",
        "description": "First-year physics covering kinematics, dynamics, energy, and wave motion. Includes lab-oriented problems and real-world applications.",
        "subChapters": ["Kinematics", "Forces and Newton's Laws", "Work and Energy", "Waves and Sound"],
        "level": "Beginner",
        "instructorId": "instructor_002",
    },
    {
        "title": "Web Development Fundamentals",
        "description": "Build modern web pages with HTML, CSS, and JavaScript. Learn responsive design, DOM manipulation, and basic front-end tooling.",
        "subChapters": ["HTML5 and Semantics", "CSS Layout and Flexbox", "JavaScript Basics", "DOM and Events"],
        "level": "Beginner",
        "instructorId": "instructor_001",
    },
    {
        "title": "Introduction to Databases",
        "description": "Relational databases, SQL, and data modeling. Covers tables, queries, joins, and basic normalization for first-year students.",
        "subChapters": ["Relational Model", "SQL Queries", "Joins and Aggregation", "Normalization"],
        "level": "Beginner",
        "instructorId": "instructor_002",
    },
    {
        "title": "Data Structures and Algorithms",
        "description": "Arrays, linked lists, stacks, queues, trees, and basic sorting and searching algorithms. Foundation for efficient programming.",
        "subChapters": ["Arrays and Lists", "Stacks and Queues", "Trees and BST", "Sorting and Searching"],
        "level": "Beginner",
        "instructorId": "instructor_001",
    },
    {
        "title": "Linear Algebra for Engineers",
        "description": "Vectors, matrices, linear systems, eigenvalues, and applications to graphics and machine learning prerequisites.",
        "subChapters": ["Vectors and Dot Product", "Matrices and Operations", "Linear Systems", "Eigenvalues"],
        "level": "Beginner",
        "instructorId": "instructor_002",
    },
    {
        "title": "Object-Oriented Programming in Java",
        "description": "Classes, inheritance, polymorphism, and design principles in Java. Build small projects to reinforce concepts.",
        "subChapters": ["Classes and Objects", "Inheritance and Polymorphism", "Interfaces and Abstraction", "Collections"],
        "level": "Beginner",
        "instructorId": "instructor_001",
    },
    {
        "title": "Digital Logic and Computer Organization",
        "description": "Boolean algebra, combinational and sequential circuits, and basic CPU organization. Introduction to how computers work.",
        "subChapters": ["Boolean Algebra", "Combinational Circuits", "Sequential Circuits", "CPU Basics"],
        "level": "Beginner",
        "instructorId": "instructor_002",
    },
    {
        "title": "Communication and Professional Skills",
        "description": "Technical writing, presentations, teamwork, and ethics. Prepares first-year students for academic and professional collaboration.",
        "subChapters": ["Technical Writing", "Presentations", "Team Projects", "Ethics and Integrity"],
        "level": "Beginner",
        "instructorId": "instructor_002",
    },
]


def build_exercises(course_ids):
    """Build 30 exercises linked to the given course IDs (list of ObjectId or str)."""
    # Map index 0..9 to course_id for distribution (3 exercises per course)
    exercises = []
    difficulties = ["easy", "medium", "hard"]

    # Predefined realistic exercises (content, correctAnswer, options or [], type) per "slot" (course index, difficulty, type)
    templates = [
        ("What is the output of print(type(3)) in Python?", "class 'int'", ["class 'int'", "integer", "3", "number"], "MCQ"),
        ("Which keyword is used to define a function in Python?", "def", ["def", "function", "func", "define"], "MCQ"),
        ("What does the range(5) function return?", "0, 1, 2, 3, 4", ["A list", "0 to 5", "0, 1, 2, 3, 4", "5 numbers"], "MCQ"),
        ("In set theory, what is |A ∪ B| when A and B are disjoint?", "|A| + |B|", ["|A| + |B|", "|A| * |B|", "max(|A|,|B|)", "0"], "MCQ"),
        ("What is 7 mod 3?", "1", ["1", "2", "0", "3"], "MCQ"),
        ("Which law states F = ma?", "Newton's second law", ["Newton's first", "Newton's second law", "Newton's third", "Law of inertia"], "MCQ"),
        ("HTML stands for:", "HyperText Markup Language", ["HyperText Markup Language", "High Tech Markup", "Home Tool Markup", "Hyperlink Text"], "MCQ"),
        ("In SQL, which clause filters rows?", "WHERE", ["WHERE", "SELECT", "FROM", "GROUP BY"], "MCQ"),
        ("A LIFO structure is a:", "Stack", ["Stack", "Queue", "Array", "Tree"], "MCQ"),
        ("Java uses which keyword for inheritance?", "extends", ["extends", "inherits", "super", "parent"], "MCQ"),
        ("Write a Python loop that prints 0 to 4.", "for i in range(5): print(i)", [], "problem"),
        ("Prove that the sum 1+2+...+n = n(n+1)/2 for n≥1.", "By induction: base n=1; step assume for n, show for n+1.", [], "problem"),
        ("Calculate the kinetic energy of a 2 kg mass at 3 m/s.", "KE = 0.5*2*9 = 9 J", [], "problem"),
        ("What CSS property centers content horizontally in a flex container?", "align-items: center or justify-content: center", [], "quiz"),
        ("Write a SQL query to find all users with age > 18.", "SELECT * FROM users WHERE age > 18;", [], "problem"),
        ("What is the time complexity of binary search?", "O(log n)", ["O(n)", "O(log n)", "O(n^2)", "O(1)"], "MCQ"),
        ("Matrix multiplication is associative: (AB)C = A(BC). True or false?", "True", ["True", "False"], "quiz"),
        ("What keyword creates a new object in Java?", "new", ["new", "create", "alloc", "object"], "MCQ"),
        ("In digital logic, AND gate output is 1 when:", "All inputs are 1", ["All inputs are 1", "Any input is 1", "No input is 1", "Exactly one is 1"], "MCQ"),
        ("Name two principles of effective technical writing.", "Clarity and conciseness (or audience focus, structure).", [], "quiz"),
        ("What data type is 3.14 in Python?", "float", ["float", "double", "decimal", "int"], "MCQ"),
        ("What is the empty set symbol?", "∅ or {}", ["∅ or {}", "0", "[]", "null"], "MCQ"),
        ("Velocity is the derivative of position with respect to:", "time", ["time", "distance", "force", "mass"], "MCQ"),
        ("Which HTML tag is used for the largest heading?", "<h1>", ["<h1>", "<head>", "<heading>", "<title>"], "MCQ"),
        ("Which SQL keyword removes duplicate rows in result?", "DISTINCT", ["DISTINCT", "UNIQUE", "ONCE", "SINGLE"], "MCQ"),
        ("A queue is FIFO. True or false?", "True", ["True", "False"], "quiz"),
        ("What is the inverse of a matrix A denoted as?", "A⁻¹", ["A⁻¹", "1/A", "A'", "inv(A)"], "MCQ"),
        ("What is method overriding in Java?", "Subclass redefines a method from parent.", ["Subclass redefines a method from parent.", "Same name different params", "Hiding a method", "Deleting a method"], "MCQ"),
        ("How many inputs does a full adder have?", "3 (A, B, Cin)", ["2", "3 (A, B, Cin)", "4", "1"], "MCQ"),
        ("What is plagiarism in academic work?", "Using others' work without credit.", ["Using others' work without credit.", "Copying code", "Working in teams", "Citing sources"], "MCQ"),
    ]

    # Assign each template to a course and difficulty; use template's type
    for i, (content, correct, options, typ) in enumerate(templates):
        course_idx = i % len(course_ids)
        diff = difficulties[i % 3]
        cid = course_ids[course_idx]
        if isinstance(cid, str):
            cid = ObjectId(cid)
        doc = {
            "courseId": cid,
            "difficulty": diff,
            "content": content,
            "correctAnswer": correct,
            "type": typ,
        }
        if options:
            doc["options"] = options
        exercises.append(doc)

    return exercises


def run_seed():
    db = get_db()
    courses_coll = db["courses"]
    exercises_coll = db["exercises"]

    print("[seed_data] Connecting to MongoDB...")
    print(f"[seed_data] Database: {config.MONGODB_DB_NAME}")

    # Clean start: delete existing courses and exercises
    del_courses = courses_coll.delete_many({})
    del_exercises = exercises_coll.delete_many({})
    print(f"[seed_data] Deleted {del_courses.deleted_count} courses and {del_exercises.deleted_count} exercises.")

    # Insert courses
    course_ids = []
    for c in SAMPLE_COURSES:
        r = courses_coll.insert_one(dict(c))
        course_ids.append(str(r.inserted_id))
    print(f"[seed_data] Inserted {len(course_ids)} courses.")

    # Build and insert exercises (30)
    exercises = build_exercises(course_ids)
    exercise_ids = []
    for e in exercises:
        r = exercises_coll.insert_one(e)
        exercise_ids.append(str(r.inserted_id))
    print(f"[seed_data] Inserted {len(exercise_ids)} exercises.")

    # Summary
    print("\n--- Summary ---")
    print(f"Courses created: {len(course_ids)}")
    for i, (c, cid) in enumerate(zip(SAMPLE_COURSES, course_ids)):
        print(f"  {i + 1}. {c['title']} -> {cid}")
    print(f"\nExercises created: {len(exercise_ids)} (mix of easy/medium/hard, MCQ/quiz/problem)")
    print(f"Course IDs: {course_ids}")
    print(f"Exercise IDs (first 5): {exercise_ids[:5]}...")

    return {"course_ids": course_ids, "exercise_ids": exercise_ids}


if __name__ == "__main__":
    run_seed()
