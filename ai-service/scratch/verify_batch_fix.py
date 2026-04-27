import sys
import os
import logging
from pprint import pprint

# Add current directory to path
sys.path.append(os.getcwd())

from level_test.batch_question_generator import generate_batch_for_subject
from core.rag_service import RAGService

# Setup logging to see our new debug prints
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger("verify_fix")

def verify():
    subject = "Base de données"
    topics = [
        "Introduction, démarrage et arrêt de la base",
        "Comptes utilisateur et sessions",
        "Privilèges et rôles",
        "Profils et fin de chapitre",
        "Dictionnaire de données",
        "Vues et synonymes",
        "Séquences et index",
        "Audit et sécurité",
        "Tablespaces et stockage",
        "Fichiers de contrôle et redo logs"
    ]
    difficulties = ["medium"] * len(topics)
    
    print(f"\n>>> TESTING BATCH GENERATION FOR '{subject}' ({len(topics)} topics) <<<\n")
    
    # Run batch generation
    # use_cache=False to force fresh generation
    results = generate_batch_for_subject(
        subject_title=subject,
        topics=topics,
        difficulties=difficulties,
        count=len(topics),
        use_cache=False
    )
    
    print(f"\n>>> GENERATION COMPLETE: {len(results)} questions produced <<<\n")
    
    seen_stems = set()
    duplicates = []
    missing_ca = []
    
    for i, q in enumerate(results):
        topic = topics[i] if i < len(topics) else "N/A"
        q_text = q.get("question", "") or q.get("questionText", "")
        ca = q.get("correctAnswer") or q.get("correct_answer")
        is_fb = q.get("is_fallback", False)
        
        # Check uniqueness (first 80 chars)
        stem = q_text[:80].lower()
        if stem in seen_stems:
            duplicates.append(f"Q{i+1} ({topic}): {q_text[:50]}...")
        seen_stems.add(stem)
        
        # Check correctAnswer
        if not ca:
            missing_ca.append(f"Q{i+1} ({topic})")
            
        print(f"[{i+1}/{len(topics)}] TOPIC: {topic}")
        print(f"      Q: {q_text[:100]}...")
        print(f"      A: {ca}")
        print(f"      FALLBACK: {is_fb} ({q.get('fallback_reason', 'N/A')})")
        print("-" * 40)

    print("\n>>> FINAL VERIFICATION SUMMARY <<<")
    print(f"Total Questions: {len(results)}")
    print(f"Duplicates found: {len(duplicates)}")
    if duplicates:
        for d in duplicates:
            print(f"  - {d}")
    
    print(f"Missing correctAnswer: {len(missing_ca)}")
    if missing_ca:
        for m in missing_ca:
            print(f"  - {m}")
            
    if len(duplicates) == 0 and len(missing_ca) == 0 and len(results) == len(topics):
        print("\n✅ VERIFICATION PASSED: No duplicates, no missing answers, correct count.")
    else:
        print("\n❌ VERIFICATION FAILED: Issues detected.")

if __name__ == "__main__":
    verify()
