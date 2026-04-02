#!/usr/bin/env python3
"""
Seed script: Create sample courses in MongoDB for level-test initialization.

This ensures that when students start a level test, real courses are available
instead of relying on the fallback sample data.

Usage: python seed_courses.py
"""

from pymongo import MongoClient
import os
from pathlib import Path

# Add ai-service to path
_SERVICE_ROOT = Path(__file__).resolve().parent
if str(_SERVICE_ROOT) not in __import__("sys").path:
    __import__("sys").path.insert(0, str(_SERVICE_ROOT))

from core.config import MONGODB_URI, MONGODB_DB_NAME


def seed_courses():
    """Insert sample courses into MongoDB."""
    client = MongoClient(MONGODB_URI)
    db = client[MONGODB_DB_NAME]
    courses_col = db["courses"]
    
    # Clear existing courses (optional - comment out to preserve)
    # courses_col.delete_many({})
    
    sample_courses = [
        {
            "id": "math_101",
            "title": "Mathematics Fundamentals",
            "description": "Master the core concepts of mathematics including algebra, geometry, calculus, and statistics.",
            "level": "beginner",
            "modules": [
                {
                    "id": "math_algebra",
                    "title": "Algebra",
                    "description": "Learn to solve equations, work with variables, and understand algebraic expressions.",
                    "topics": ["Linear equations", "Quadratic equations", "Polynomial functions"]
                },
                {
                    "id": "math_geometry",
                    "title": "Geometry",
                    "description": "Explore shapes, angles, proofs, and spatial geometry.",
                    "topics": ["Triangles", "Circles", "3D shapes", "Proofs"]
                },
                {
                    "id": "math_calculus",
                    "title": "Calculus",
                    "description": "Introduction to limits, derivatives, and integrals.",
                    "topics": ["Limits", "Derivatives", "Integrals", "Applications"]
                },
                {
                    "id": "math_statistics",
                    "title": "Statistics",
                    "description": "Understand data analysis, probability, and statistical methods.",
                    "topics": ["Descriptive statistics", "Probability", "Distributions", "Hypothesis testing"]
                },
                {
                    "id": "math_numbertheory",
                    "title": "Number Theory",
                    "description": "Explore properties of numbers and arithmetic fundamentals.",
                    "topics": ["Prime numbers", "Divisibility", "GCD and LCM", "Modular arithmetic"]
                }
            ]
        },
        {
            "id": "science_101",
            "title": "General Science",
            "description": "Comprehensive introduction to physics, chemistry, and biology.",
            "level": "beginner",
            "modules": [
                {
                    "id": "sci_physics",
                    "title": "Physics",
                    "description": "Study motion, forces, energy, and waves.",
                    "topics": ["Kinematics", "Forces and Newton's laws", "Energy and work", "Waves and sound"]
                },
                {
                    "id": "sci_chemistry",
                    "title": "Chemistry",
                    "description": "Learn about atomic structure, reactions, and chemical bonds.",
                    "topics": ["Atomic structure", "Chemical bonding", "Reactions", "Stoichiometry"]
                },
                {
                    "id": "sci_biology",
                    "title": "Biology",
                    "description": "Understand living systems, genetics, and evolution.",
                    "topics": ["Cell biology", "Genetics", "Evolution", "Ecology"]
                },
                {
                    "id": "sci_earth",
                    "title": "Earth Science",
                    "description": "Explore geology, weather, and environmental science.",
                    "topics": ["Plate tectonics", "Weather systems", "Climate", "Natural resources"]
                },
                {
                    "id": "sci_astronomy",
                    "title": "Astronomy",
                    "description": "Learn about stars, planets, and the universe.",
                    "topics": ["Solar system", "Stars", "Galaxies", "Cosmology"]
                }
            ]
        },
        {
            "id": "english_101",
            "title": "English & Literature",
            "description": "Develop reading, writing, and literary analysis skills.",
            "level": "beginner",
            "modules": [
                {
                    "id": "eng_grammar",
                    "title": "Grammar",
                    "description": "Master sentence structure, punctuation, and syntax.",
                    "topics": ["Parts of speech", "Sentence structure", "Punctuation", "Common errors"]
                },
                {
                    "id": "eng_vocabulary",
                    "title": "Vocabulary",
                    "description": "Expand your word bank and understand word usage.",
                    "topics": ["Word roots", "Synonyms and antonyms", "Context clues", "Academic vocabulary"]
                },
                {
                    "id": "eng_reading",
                    "title": "Reading Comprehension",
                    "description": "Develop skills to understand and analyze texts.",
                    "topics": ["Main idea", "Supporting details", "Inference", "Critical thinking"]
                },
                {
                    "id": "eng_writing",
                    "title": "Writing",
                    "description": "Learn to write essays, reports, and creative pieces.",
                    "topics": ["Essay structure", "Argumentation", "Style", "Revision techniques"]
                },
                {
                    "id": "eng_literature",
                    "title": "Literature",
                    "description": "Analyze novels, poetry, plays, and short stories.",
                    "topics": ["Literary elements", "Poetry analysis", "Character development", "Themes"]
                }
            ]
        },
        {
            "id": "history_101",
            "title": "World History",
            "description": "Explore major historical events and civilizations.",
            "level": "beginner",
            "modules": [
                {
                    "id": "hist_ancient",
                    "title": "Ancient Civilizations",
                    "description": "Study ancient Egypt, Greece, Rome, and beyond.",
                    "topics": ["Ancient Egypt", "Classical Greece", "Roman Empire", "Ancient Asia"]
                },
                {
                    "id": "hist_medieval",
                    "title": "Medieval Period",
                    "description": "Examine the Middle Ages and its cultural developments.",
                    "topics": ["Feudalism", "Middle Ages society", "Islamic Golden Age", "Medieval Europe"]
                },
                {
                    "id": "hist_renaissance",
                    "title": "Renaissance & Enlightenment",
                    "description": "Learn about the Renaissance and Age of Enlightenment.",
                    "topics": ["Italian Renaissance", "Enlightenment ideas", "Scientific Revolution", "Humanism"]
                },
                {
                    "id": "hist_modern",
                    "title": "Modern History",
                    "description": "Study major events from 1800s to present.",
                    "topics": ["Industrialization", "World Wars", "Cold War", "Contemporary history"]
                },
                {
                    "id": "hist_asia",
                    "title": "Asian History",
                    "description": "Explore the history of Asian civilizations.",
                    "topics": ["Chinese dynasties", "Indian civilization", "Japanese history", "Southeast Asia"]
                }
            ]
        }
    ]
    
    # Insert or update courses
    for course in sample_courses:
        courses_col.update_one(
            {"id": course["id"]},
            {"$set": course},
            upsert=True
        )
        print(f"✅ Seeded course: {course['title']}")
    
    print(f"\n🎓 Successfully seeded {len(sample_courses)} courses!")
    print(f"📊 Course count in database: {courses_col.count_documents({})}")
    
    client.close()


if __name__ == "__main__":
    try:
        seed_courses()
    except Exception as e:
        print(f"❌ Error seeding courses: {e}")
        raise
