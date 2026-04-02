import re

from generation.question_generator import generate_level_test_question


def _is_french(text: str) -> bool:
    if not isinstance(text, str):
        return False
    # Simple heuristic: French diacritics or French interrogatives
    return bool(
        re.search(r"[éèêëàâùûôîïç]", text)
        or re.search(r"^(Quel|Quelle|Quels|Quelles|Pourquoi|Comment|Qu'est-ce)", text.strip(), re.I)
    )


def main() -> None:
    subject = "Programmation Procédurale 1"
    cases = [
        ("easy", "3.2 - Boucle do while"),
        ("medium", "2.2 - Structure switch"),
        ("medium", "1.6 - Opérateurs arithmétiques et logiques"),
        ("hard", "4.7 - Recherche dichotomique"),
        ("medium", "5.3 - Fonctions de string.h"),
    ]

    for diff, topic in cases:
        q = generate_level_test_question(subject=subject, difficulty=diff, topic=topic)
        assert q and isinstance(q, dict), f"no question for {diff=} {topic=}"
        assert isinstance(q.get("question"), str) and q["question"].strip()
        assert isinstance(q.get("options"), list) and len(q["options"]) == 4
        assert isinstance(q.get("correct_answer"), str) and q["correct_answer"].strip()
        assert q["correct_answer"] in q["options"], "correct_answer not in options"
        assert q.get("topic") is not None, "topic missing"
        # Avoid step-list options
        opt_blob = " ".join(str(x) for x in q["options"]).lower()
        assert opt_blob.count("étape") < 2, "step-list style options"
        # French-only pool for this course
        assert _is_french(q["question"]), "question not in French"

        print("-" * 60)
        print(f"{diff.upper()} | {topic}")
        print(q["question"])
        for i, o in enumerate(q["options"], 1):
            mark = "*" if o == q["correct_answer"] else " "
            print(f" {mark} {i}. {o}")
        print("Explanation:", (q.get("explanation") or "")[:120])


if __name__ == "__main__":
    main()

