# Quiz Dual-Mode Fix - Résolution du Bug

## 🐛 Le Problème

Quand l'utilisateur choisissait "Fichier de quiz (PDF/Word)" mais que des questions vides restaient en mémoire, le système validait ces questions au lieu du fichier, causant l'erreur:

```
Question 1: question text is required.
```

## 🔍 Root Cause

1. **Frontend**: La validation utilisait `!this.selectedQuizFile` pour décider si valider les questions, pas le `quizMode`
   - Problème: `this.selectedQuizFile` est null jusqu'au clic sur "Choisir un fichier"
   - Même en mode "file", les questions vides sont validées

2. **Backend**: La validation cherchait `quizText` (jamais envoyé) au lieu de vérifier si un fichier a été uploadé
   - Problème: Rejetait les quizzes fichier valides en disant "Quiz questions required"

## ✅ La Solution

### Frontend (instructor-subjects.component.ts)

**Changement 1: Validation basée sur `quizMode`**

```typescript
if (type === "quiz") {
  const quizMode = this.chapterContentForm.quizMode || "inline";

  if (quizMode === "inline") {
    // Validate inline questions
    if (!quizQuestions.length) {
      error;
    }
    // Validate each question...
  } else if (quizMode === "file") {
    // Validate file only
    if (!this.selectedQuizFile) {
      error;
    }
  }
}
```

**Changement 2: Payload conditionnel**

```typescript
if (type === 'quiz') {
  const quizMode = this.chapterContentForm.quizMode || 'inline';

  // Only send questions in inline mode
  if (quizMode === 'inline') {
    payload.quizQuestions = [ ... ];
  }

  // Upload file if provided
  if (this.selectedQuizFile) {
    payload.fileName = ...;
    payload.url = ...;
  }
}
```

### Backend (subjects.service.ts)

**Changement 1: Vérifier le fichier aussi**

```typescript
const hasQuizQuestions =
  Array.isArray(quizQuestions) && quizQuestions.length > 0;
const hasQuizFile = Boolean(fileName || url); // ← NEW!

if (type === "quiz" && !hasQuizQuestions && !hasQuizFile) {
  throw "Quiz must have either inline questions or a quiz file";
}

// Only validate questions if they exist
if (type === "quiz" && hasQuizQuestions) {
  this.validateQuizQuestions(quizQuestions);
}
```

## 🎯 Résultat

| Mode       | Frontend Validation | Backend Validation  | Payload                                  |
| ---------- | ------------------- | ------------------- | ---------------------------------------- |
| **Inline** | ✅ Valide questions | ✅ Valide questions | `quizQuestions: [...]`                   |
| **File**   | ✅ Valide fichier   | ✅ Valide fichier   | `fileName`, `url` (pas de quizQuestions) |

## 🧪 Test Case

1. **Créer quiz mode file**:
   - Sélectionnez "Dossier Exercices" → Type "quiz"
   - Sélectionnez radio "Fichier de quiz (PDF/Word)"
   - **Ne remplissez PAS les questions en ligne** (reste vides)
   - Cliquez "Choisir un fichier" et sélectionnez quiz.pdf
   - Cliquez "Save content"
   - ✅ Devrait succéder (pas d'erreur "Question 1: question text is required")

2. **Créer quiz mode inline**:
   - Sélectionnez radio "Questions en ligne (Choix multiples)"
   - Remplissez Question 1, options, etc.
   - Cliquez "Save content"
   - ✅ Devrait succéder

3. **Erreur attendue - mode file sans fichier**:
   - Sélectionnez radio "Fichier de quiz"
   - Ne sélectionnez PAS de fichier
   - Cliquez "Save content"
   - ✅ Erreur: "Please upload a quiz file."

## 📝 Fichiers Modifiés

- ✅ `frontend/src/app/.../instructor-subjects.component.ts` (2 changes)
- ✅ `backend/src/subjects/subjects.service.ts` (1 change)

## 🚀 Déploiement

- Backend build: ✅ Success
- Frontend: Prêt pour `ng serve`
