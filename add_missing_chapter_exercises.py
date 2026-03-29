import sys
from pathlib import Path
from bson import ObjectId

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / "ai-service"))

from core.db_connection import get_database, get_all_courses
from level_test.real_exercise_loader import get_questions_for_course


def make_q(content, options, answer, difficulty, subject, topic):
    return {
        "type": "MCQ",
        "content": content,
        "options": options,
        "correctAnswer": answer,
        "difficulty": difficulty,
        "subject": subject,
        "topic": topic,
    }


def chapter_bank(chapter_title: str):
    if chapter_title.startswith("Chapitre 1"):
        return [
            make_q(
                "Pourquoi utilise-t-on scanf en C ?",
                [
                    "A. Pour lire une valeur entrée au clavier",
                    "B. Pour afficher une valeur à l'écran",
                    "C. Pour compiler le programme",
                    "D. Pour effacer la mémoire",
                ],
                "A. Pour lire une valeur entrée au clavier",
                "easy",
                "Programmation Procédurale 1",
                chapter_title,
            )
        ]

    if chapter_title.startswith("Chapitre 2"):
        return [
            make_q(
                "Quelle structure permet d'exécuter un bloc seulement si une condition est vraie ?",
                [
                    "A. if",
                    "B. while",
                    "C. for",
                    "D. scanf",
                ],
                "A. if",
                "easy",
                "Programmation Procédurale 1",
                chapter_title,
            ),
            make_q(
                "Dans if (x > 0) { ... } else { ... }, le bloc else est exécuté quand :",
                [
                    "A. x > 0",
                    "B. x <= 0",
                    "C. x est impair",
                    "D. x est toujours positif",
                ],
                "B. x <= 0",
                "easy",
                "Programmation Procédurale 1",
                chapter_title,
            ),
            make_q(
                "Quel opérateur représente l'égalité en C ?",
                [
                    "A. =",
                    "B. ==",
                    "C. !=",
                    "D. >=",
                ],
                "B. ==",
                "medium",
                "Programmation Procédurale 1",
                chapter_title,
            ),
            make_q(
                "Quelle est la sortie si x=3 pour: if (x>5) printf(\"A\"); else printf(\"B\");",
                [
                    "A. A",
                    "B. B",
                    "C. AB",
                    "D. Erreur",
                ],
                "B. B",
                "medium",
                "Programmation Procédurale 1",
                chapter_title,
            ),
            make_q(
                "Pour tester si un nombre est pair, on vérifie généralement :",
                [
                    "A. n % 2 == 0",
                    "B. n / 2 == 0",
                    "C. n + 2 == 0",
                    "D. n - 2 == 0",
                ],
                "A. n % 2 == 0",
                "medium",
                "Programmation Procédurale 1",
                chapter_title,
            ),
        ]

    if chapter_title.startswith("Chapitre 3"):
        return [
            make_q(
                "Quelle boucle est la plus adaptée quand le nombre d'itérations est connu ?",
                [
                    "A. for",
                    "B. if",
                    "C. switch",
                    "D. scanf",
                ],
                "A. for",
                "easy",
                "Programmation Procédurale 1",
                chapter_title,
            )
        ]

    if chapter_title.startswith("Chapitre 4"):
        return [
            make_q(
                "Dans un tableau int t[5], quel est l'indice du premier élément ?",
                [
                    "A. 0",
                    "B. 1",
                    "C. 5",
                    "D. -1",
                ],
                "A. 0",
                "easy",
                "Programmation Procédurale 1",
                chapter_title,
            )
        ]

    if chapter_title.startswith("Chapitre 5"):
        return [
            make_q(
                "Quelle fonction C calcule la longueur d'une chaîne ?",
                [
                    "A. strlen",
                    "B. strcpy",
                    "C. strcat",
                    "D. scanf",
                ],
                "A. strlen",
                "easy",
                "Programmation Procédurale 1",
                chapter_title,
            ),
            make_q(
                "Que fait strcpy(dest, src) ?",
                [
                    "A. Compare deux chaînes",
                    "B. Copie src dans dest",
                    "C. Concatène src à dest",
                    "D. Calcule la taille de dest",
                ],
                "B. Copie src dans dest",
                "easy",
                "Programmation Procédurale 1",
                chapter_title,
            ),
            make_q(
                "Quelle fonction compare deux chaînes de caractères ?",
                [
                    "A. strcmp",
                    "B. strlen",
                    "C. strcpy",
                    "D. strcat",
                ],
                "A. strcmp",
                "medium",
                "Programmation Procédurale 1",
                chapter_title,
            ),
            make_q(
                "Que contient la fin d'une chaîne en C ?",
                [
                    "A. Le caractère '\\0'",
                    "B. Le caractère '\\n'",
                    "C. Le caractère EOF",
                    "D. Un espace",
                ],
                "A. Le caractère '\\0'",
                "medium",
                "Programmation Procédurale 1",
                chapter_title,
            ),
            make_q(
                "Quelle est la sortie de printf(\"%s\", \"C\"); ?",
                [
                    "A. C",
                    "B. %s",
                    "C. Erreur",
                    "D. Rien",
                ],
                "A. C",
                "easy",
                "Programmation Procédurale 1",
                chapter_title,
            ),
            make_q(
                "Quelle fonction concatène deux chaînes ?",
                [
                    "A. strcat",
                    "B. strcmp",
                    "C. strlen",
                    "D. scanf",
                ],
                "A. strcat",
                "medium",
                "Programmation Procédurale 1",
                chapter_title,
            ),
        ]

    if chapter_title.startswith("Chapitre 6"):
        return [
            make_q(
                "Quel mot-clé sert à déclarer une structure en C ?",
                [
                    "A. struct",
                    "B. class",
                    "C. object",
                    "D. type",
                ],
                "A. struct",
                "easy",
                "Programmation Procédurale 1",
                chapter_title,
            ),
            make_q(
                "Pour accéder au champ age de la variable p (structure), on écrit :",
                [
                    "A. p->age",
                    "B. p.age",
                    "C. p:age",
                    "D. age.p",
                ],
                "B. p.age",
                "easy",
                "Programmation Procédurale 1",
                chapter_title,
            ),
            make_q(
                "Quel opérateur est utilisé avec un pointeur vers structure ?",
                [
                    "A. .",
                    "B. ->",
                    "C. ::",
                    "D. =>",
                ],
                "B. ->",
                "medium",
                "Programmation Procédurale 1",
                chapter_title,
            ),
            make_q(
                "Une structure peut contenir :",
                [
                    "A. Plusieurs champs de types différents",
                    "B. Uniquement des int",
                    "C. Uniquement des char",
                    "D. Uniquement des tableaux",
                ],
                "A. Plusieurs champs de types différents",
                "easy",
                "Programmation Procédurale 1",
                chapter_title,
            ),
            make_q(
                "Quelle déclaration est correcte ?",
                [
                    "A. struct Etudiant { int age; char nom[20]; };",
                    "B. structure Etudiant { int age; };",
                    "C. Etudiant struct { int age; };",
                    "D. struct { int age; } Etudiant();",
                ],
                "A. struct Etudiant { int age; char nom[20]; };",
                "hard",
                "Programmation Procédurale 1",
                chapter_title,
            ),
            make_q(
                "Que représente un tableau de structures ?",
                [
                    "A. Plusieurs enregistrements du même type",
                    "B. Une seule variable simple",
                    "C. Une fonction spéciale",
                    "D. Une constante",
                ],
                "A. Plusieurs enregistrements du même type",
                "medium",
                "Programmation Procédurale 1",
                chapter_title,
            ),
        ]

    if chapter_title.startswith("Chapitre 7"):
        return [
            make_q(
                "Qu'est-ce qu'un pointeur en C ?",
                [
                    "A. Une variable qui stocke une adresse mémoire",
                    "B. Une variable qui stocke uniquement un float",
                    "C. Une boucle",
                    "D. Une bibliothèque",
                ],
                "A. Une variable qui stocke une adresse mémoire",
                "easy",
                "Programmation Procédurale 1",
                chapter_title,
            ),
            make_q(
                "Quel opérateur donne l'adresse d'une variable ?",
                [
                    "A. *",
                    "B. &",
                    "C. %",
                    "D. #",
                ],
                "B. &",
                "easy",
                "Programmation Procédurale 1",
                chapter_title,
            ),
            make_q(
                "Que fait l'opérateur * appliqué à un pointeur ?",
                [
                    "A. Il donne la valeur pointée",
                    "B. Il donne l'adresse du pointeur",
                    "C. Il compile le code",
                    "D. Il compare deux pointeurs",
                ],
                "A. Il donne la valeur pointée",
                "medium",
                "Programmation Procédurale 1",
                chapter_title,
            ),
            make_q(
                "Si int x=10; int *p=&x; quelle est la valeur de *p ?",
                [
                    "A. Adresse de x",
                    "B. 10",
                    "C. 0",
                    "D. Erreur",
                ],
                "B. 10",
                "medium",
                "Programmation Procédurale 1",
                chapter_title,
            ),
            make_q(
                "Un pointeur non initialisé peut provoquer :",
                [
                    "A. Un comportement indéfini",
                    "B. Une optimisation automatique",
                    "C. Une compilation plus rapide",
                    "D. Une conversion en tableau",
                ],
                "A. Un comportement indéfini",
                "hard",
                "Programmation Procédurale 1",
                chapter_title,
            ),
            make_q(
                "Quelle déclaration est correcte pour un pointeur sur int ?",
                [
                    "A. int *p;",
                    "B. int p*;",
                    "C. pointer int p;",
                    "D. p int*;",
                ],
                "A. int *p;",
                "easy",
                "Programmation Procédurale 1",
                chapter_title,
            ),
        ]

    if chapter_title.startswith("Chapitre 8"):
        return [
            make_q(
                "Quel est le rôle principal d'une fonction en C ?",
                [
                    "A. Réutiliser un bloc de code",
                    "B. Créer un nouveau type",
                    "C. Gérer uniquement l'affichage",
                    "D. Remplacer le compilateur",
                ],
                "A. Réutiliser un bloc de code",
                "easy",
                "Programmation Procédurale 1",
                chapter_title,
            ),
            make_q(
                "Quelle syntaxe est correcte pour déclarer une fonction sans retour ?",
                [
                    "A. void afficher();",
                    "B. function afficher();",
                    "C. int afficher[];",
                    "D. return afficher();",
                ],
                "A. void afficher();",
                "easy",
                "Programmation Procédurale 1",
                chapter_title,
            ),
            make_q(
                "Que signifie return dans une fonction ?",
                [
                    "A. Afficher une variable",
                    "B. Renvoyer une valeur à l'appelant",
                    "C. Déclarer un pointeur",
                    "D. Créer une structure",
                ],
                "B. Renvoyer une valeur à l'appelant",
                "medium",
                "Programmation Procédurale 1",
                chapter_title,
            ),
            make_q(
                "Les paramètres d'une fonction servent à :",
                [
                    "A. Recevoir des données en entrée",
                    "B. Stocker uniquement des constantes",
                    "C. Fermer le programme",
                    "D. Déclarer des bibliothèques",
                ],
                "A. Recevoir des données en entrée",
                "medium",
                "Programmation Procédurale 1",
                chapter_title,
            ),
            make_q(
                "Quelle est la différence entre déclaration et définition de fonction ?",
                [
                    "A. La déclaration donne la signature, la définition donne le corps",
                    "B. Il n'y a aucune différence",
                    "C. La définition est toujours dans un fichier .h",
                    "D. La déclaration contient les instructions",
                ],
                "A. La déclaration donne la signature, la définition donne le corps",
                "hard",
                "Programmation Procédurale 1",
                chapter_title,
            ),
            make_q(
                "Quelle fonction est appelée en premier dans un programme C standard ?",
                [
                    "A. start",
                    "B. init",
                    "C. main",
                    "D. run",
                ],
                "C. main",
                "easy",
                "Programmation Procédurale 1",
                chapter_title,
            ),
        ]

    return []


def main():
    db = get_database()
    exercises = db["exercises"]
    courses = get_all_courses()

    inserted = 0
    skipped = 0

    for c in courses:
        cid = c.get("id")
        title = c.get("title", "")
        existing_valid = get_questions_for_course(cid, num_questions=1000, difficulty=None)
        need = max(0, 5 - len(existing_valid))
        if need <= 0:
            continue

        bank = chapter_bank(title)
        if not bank:
            continue

        course_oid = ObjectId(cid) if ObjectId.is_valid(str(cid)) else cid

        for q in bank:
            if need <= 0:
                break
            found = exercises.find_one({"courseId": course_oid, "content": q["content"]})
            if found:
                skipped += 1
                continue

            doc = dict(q)
            doc["courseId"] = course_oid
            exercises.insert_one(doc)
            inserted += 1
            need -= 1

    print(f"Inserted: {inserted}")
    print(f"Skipped existing: {skipped}")


if __name__ == "__main__":
    main()
