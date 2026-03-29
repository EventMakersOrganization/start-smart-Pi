import sys
from pathlib import Path
from bson import ObjectId

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / "ai-service"))

from core.db_connection import get_database, get_all_courses
from level_test.real_exercise_loader import get_questions_for_course


def q(content, options, correct, difficulty, topic):
    return {
        "type": "MCQ",
        "content": content,
        "options": options,
        "correctAnswer": correct,
        "difficulty": difficulty,
        "subject": "Programmation Procédurale 1",
        "topic": topic,
    }


def bank_for(title):
    if title.startswith("Chapitre 2"):
        return [
            q(
                "Dans une structure conditionnelle, quel bloc est exécuté quand la condition est vraie ?",
                [
                    "A. Le bloc if est exécuté quand la condition est vraie",
                    "B. Le bloc else est exécuté quand la condition est vraie",
                    "C. Le bloc while est exécuté quand la condition est vraie",
                    "D. Le bloc switch est exécuté quand la condition est vraie",
                ],
                "A. Le bloc if est exécuté quand la condition est vraie",
                "easy",
                title,
            ),
            q(
                "Quelle condition permet d'entrer dans le bloc if pour un nombre n positif ?",
                [
                    "A. La condition n > 0 permet d'entrer dans le bloc if",
                    "B. La condition n < 0 permet d'entrer dans le bloc if",
                    "C. La condition n == -1 permet d'entrer dans le bloc if",
                    "D. La condition n != 0 empêche d'entrer dans le bloc if",
                ],
                "A. La condition n > 0 permet d'entrer dans le bloc if",
                "medium",
                title,
            ),
            q(
                "Quand la condition if est fausse, quelle branche est exécutée dans if/else ?",
                [
                    "A. La branche else est exécutée quand la condition if est fausse",
                    "B. La branche if est exécutée quand la condition if est fausse",
                    "C. Les deux branches if et else sont exécutées",
                    "D. Aucune branche n'est exécutée dans if/else",
                ],
                "A. La branche else est exécutée quand la condition if est fausse",
                "easy",
                title,
            ),
        ]

    if title.startswith("Chapitre 5"):
        return [
            q(
                "Dans une chaîne de caractères en C, quel caractère termine la chaîne ?",
                [
                    "A. Le caractère nul '\\0' termine la chaîne de caractères",
                    "B. Le caractère '\\n' termine la chaîne de caractères",
                    "C. Le caractère espace termine la chaîne de caractères",
                    "D. Le caractère '%' termine la chaîne de caractères",
                ],
                "A. Le caractère nul '\\0' termine la chaîne de caractères",
                "easy",
                title,
            ),
            q(
                "Quelle fonction de chaîne de caractères calcule la longueur d'une chaîne ?",
                [
                    "A. La fonction strlen calcule la longueur d'une chaîne",
                    "B. La fonction strcpy calcule la longueur d'une chaîne",
                    "C. La fonction strcat calcule la longueur d'une chaîne",
                    "D. La fonction scanf calcule la longueur d'une chaîne",
                ],
                "A. La fonction strlen calcule la longueur d'une chaîne",
                "easy",
                title,
            ),
            q(
                "Quelle fonction compare deux chaînes de caractères en C ?",
                [
                    "A. La fonction strcmp compare deux chaînes de caractères",
                    "B. La fonction strcpy compare deux chaînes de caractères",
                    "C. La fonction strlen compare deux chaînes de caractères",
                    "D. La fonction printf compare deux chaînes de caractères",
                ],
                "A. La fonction strcmp compare deux chaînes de caractères",
                "medium",
                title,
            ),
        ]

    if title.startswith("Chapitre 6"):
        return [
            q(
                "Pour accéder au champ age de la structure p, quelle écriture est correcte ?",
                [
                    "A. L'écriture p.age accède au champ age de la structure p",
                    "B. L'écriture p->age accède au champ age de la structure p non pointeur",
                    "C. L'écriture age.p accède au champ age de la structure p",
                    "D. L'écriture p:age accède au champ age de la structure p",
                ],
                "A. L'écriture p.age accède au champ age de la structure p",
                "easy",
                title,
            )
        ]

    if title.startswith("Chapitre 7"):
        return [
            q(
                "Que peut provoquer un pointeur non initialisé en langage C ?",
                [
                    "A. Un pointeur non initialisé peut provoquer un comportement indéfini",
                    "B. Un pointeur non initialisé peut provoquer une compilation plus rapide",
                    "C. Un pointeur non initialisé peut provoquer une conversion automatique en int",
                    "D. Un pointeur non initialisé peut provoquer une suppression des variables",
                ],
                "A. Un pointeur non initialisé peut provoquer un comportement indéfini",
                "hard",
                title,
            )
        ]

    if title.startswith("Chapitre 8"):
        return [
            q(
                "Quelle déclaration de fonction sans retour est correcte en C ?",
                [
                    "A. La déclaration void afficher(); est une déclaration de fonction sans retour correcte",
                    "B. La déclaration function afficher(); est une déclaration de fonction sans retour correcte",
                    "C. La déclaration int afficher[]; est une déclaration de fonction sans retour correcte",
                    "D. La déclaration return afficher(); est une déclaration de fonction sans retour correcte",
                ],
                "A. La déclaration void afficher(); est une déclaration de fonction sans retour correcte",
                "easy",
                title,
            )
        ]

    return []


def main():
    db = get_database()
    ex = db["exercises"]
    inserted = 0

    for c in get_all_courses():
        cid = c.get("id")
        title = c.get("title", "")
        valid = get_questions_for_course(cid, num_questions=1000, difficulty=None)
        need = max(0, 5 - len(valid))
        if need == 0:
            continue

        extra = bank_for(title)
        if not extra:
            continue

        cid_obj = ObjectId(cid) if ObjectId.is_valid(str(cid)) else cid
        for item in extra:
            if need == 0:
                break
            if ex.find_one({"courseId": cid_obj, "content": item["content"]}):
                continue
            doc = dict(item)
            doc["courseId"] = cid_obj
            ex.insert_one(doc)
            inserted += 1
            need -= 1

    print(f"Inserted top-up: {inserted}")


if __name__ == "__main__":
    main()
