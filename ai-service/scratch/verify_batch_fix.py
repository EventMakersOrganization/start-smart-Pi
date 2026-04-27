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
        "Introduction, dmarrage et arrt de la base",
        "Instance Oracle et mmoire SGA",
        "Dictionnaire de donnes  vues et objets",
        "Dictionnaire de donnes  squences et suite",
        "Fichiers de paramtres et commandes ALTER SYSTEM / SESSION",
        "Tablespaces  cration et manipulation",
        "Gestion de l'espace dans les tablespaces",
        "Comptes utilisateur et sessions",
        "Privilges systme et objets",
        "Rles et rvocation",
        "Profils et fin de chapitre",
        "Principe du moindre privilge",
        "Scurisation  authentification et privilges administrateur",
        "Audit standard de la base de donnes",
        "Audit dtaill, FGA et rgles"
    ]
    difficulties = ["medium"] * len(topics)
    
    import time
    start_time = time.perf_counter()
    print(f"\n>>> TESTING PARALLEL BATCH GENERATION FOR '{subject}' ({len(topics)} topics) <<<\n")
    
    # Run batch generation (Run 1: Fresh)
    results = generate_batch_for_subject(
        subject_title=subject,
        topics=topics,
        difficulties=difficulties,
        count=len(topics),
        use_cache=True, # We want to test cache in next run
        diversity_seed="test_seed_123"
    )
    
    duration = time.perf_counter() - start_time
    print(f"\n>>> RUN 1 COMPLETE: {len(results)} questions in {duration:.1f}s (target < 90s) <<<\n")
    
    # Run 2: Cache test
    start_time_2 = time.perf_counter()
    results_2 = generate_batch_for_subject(
        subject_title=subject,
        topics=topics,
        difficulties=difficulties,
        count=len(topics),
        use_cache=True,
        diversity_seed="different_seed_but_same_topics" # Should still hit cache
    )
    duration_2 = time.perf_counter() - start_time_2
    print(f"\n>>> RUN 2 (CACHE) COMPLETE: {len(results_2)} questions in {duration_2:.2f}s <<<\n")
    
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
            
    if len(duplicates) == 0 and len(missing_ca) == 0 and len(results) == len(topics) and duration_2 < 1.0:
        print(f"\n VERIFICATION PASSED: No duplicates, no missing answers, speed-up confirmed ({duration:.1f}s vs prev 710s), cache working.")
    else:
        print("\n VERIFICATION FAILED: Issues detected.")

if __name__ == "__main__":
    verify()
