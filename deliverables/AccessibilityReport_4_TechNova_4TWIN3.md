# Accessibility Audit (WCAG 2.1) — ProjectCode **4** — Team **TechNova** — Class **4TWIN3**

**Product:** Start-Smart — Angular frontend (`frontend/`)  
**Audit date:** 2026-05-04  
**Target conformance:** **WCAG 2.1 Level AA** (stated course requirement)  
**Methodology:** Static **codebase audit** + recommended tool runs (**axe DevTools**, **WAVE**, **Lighthouse accessibility**). This document **does not** attach automated tool JSON (no captured axe/Lighthouse run in CI at time of writing).

---

## 1. Compliance summary (honest)

| Level | Status | Rationale |
|-------|--------|-----------|
| **A** | **Largely met** (code evidence) | Skip link present, `lang` on HTML document, semantic landmarks used in multiple layouts, many interactive controls have `aria-label`, some images have `alt`. |
| **AA** | **Partially met** | Several templates still ship `<img>` without alternative text; not all form controls have an associated visible `<label>` / `aria-labelledby`; limited keyboard shortcut patterns; color contrast not machine-verified in this document. |

**Gap to full AA:** resolve image text alternatives (1.1.1), ensure every input has programmatic name (3.3.2 / 4.1.2), verify focus order on complex widgets (2.4.3), run automated contrast checks on Tailwind token pairs (1.4.3).

---

## 2. Tools recommended (evidence collection)

| Tool | Use |
|------|-----|
| **axe DevTools** (browser extension) | Full-page scan on `/login`, `/student-dashboard`, `/instructor-dashboard`, `/chat/ai`, `/analytics` |
| **WAVE** | Visual overlay for structure + contrast alerts |
| **Lighthouse → Accessibility** | Regression score + duplicate checks |
| **pa11y-ci** (optional CI) | `npx pa11y-ci` against static build URL |

---

## 3. Positive findings (already in repository)

### 3.1 Bypass block (2.4.1)

- **Skip link** to `#main-content` with screen-reader-only / focus-visible styling in [`frontend/src/app/app.component.html`](frontend/src/app/app.component.html):

```html
<a class="sr-only focus:not-sr-only ... " href="#main-content">Skip to main content</a>
```

### 3.2 Page language (3.1.1)

- Root document language: **`lang="en"`** in [`frontend/src/index.html`](frontend/src/index.html) (verified pattern).

### 3.3 Landmarks & structure (1.3.1, 2.4.1)

- Multiple routed views use semantic elements such as **`<main>`**, **`<nav>`**, **`<header>`**, **`<footer>`**, **`<section>`** (grep-based survey across templates — not universal on every view, but recurring in layouts).

### 3.4 Name, Role, Value (4.1.2) — partial

- **`aria-label` / `[attr.aria-label]`:** ~**25** occurrences across **~15** HTML templates (icon buttons, toolbar actions).
- **`role=` attributes:** ~**12** occurrences across **~8** files (banner/main/region patterns where used).

### 3.5 Forms (3.3.2, 1.3.1)

- **`formControlName`:** ~**25** bindings — Reactive forms in use.
- **Explicit `<label for="...">`:** ~**13** occurrences — good where present.

### 3.6 Keyboard & focus (2.1.1, 2.4.3)

- **`tabindex`:** ~**10** occurrences — indicates manual focus management attempts in some components.

### 3.7 Theming (1.4.3 — needs measurement)

- **Tailwind** design tokens + **`darkMode: 'class'`** in [`frontend/tailwind.config.js`](frontend/tailwind.config.js) — supports dark theme toggle pattern; **contrast compliance must be verified with axe/WAVE**, not assumed from token names.

---

## 4. Issues discovered (code-evidence)

### 4.1 Images without text alternatives (1.1.1 Level A)

- **~20 `<img>` tags** in templates; **~8** include `alt` / `[alt]` bindings; **~12** lack a text alternative (notably **chat avatars**, **instructor-subjects** attachment thumbnails).
- **Remediation:** add meaningful `alt=""` only for decorative images; otherwise descriptive `alt` or `aria-labelledby` pointing to visible filename/caption.

### 4.2 Programmatic labels gaps (3.3.2, 4.1.2)

- **`mat-label`:** **0** occurrences (Angular Material label directive not used in survey).
- Reactive forms exist without matching explicit `<label>` for every control — **gap** for screen reader name computation.

**Remediation:** pair each input with `<label [for]="controlId">`, `aria-label`, or `aria-labelledby` referencing visible text.

### 4.3 ARIA relationships (1.3.1, 4.1.2)

- **`aria-labelledby` / `aria-describedby`:** **0** matches in HTML templates (survey) — complex widgets (dialogs, steppers) may lack programmatic description.

### 4.4 Keyboard-only operation (2.1.1)

- **No `(keydown)`** handlers found on templates for custom shortcuts; **no** CDK **`FocusTrap`** usage — modals/custom overlays may not trap focus (needs manual test).

### 4.5 Duplicate route definition (operational / UX)

- Duplicate `path: 'analytics'` blocks in [`frontend/src/app/app-routing.module.ts`](frontend/src/app/app-routing.module.ts) — not strictly WCAG, but can cause unpredictable navigation focus history.

---

## 5. WCAG 2.1 mapping table

| Success Criterion | Level | Status | Evidence / notes |
|-------------------|-------|--------|------------------|
| 1.1.1 Non-text Content | A | **Partial** | Many `<img>` missing `alt` |
| 1.3.1 Info and Relationships | A | **Partial** | Landmarks good; `aria-labelledby` absent |
| 1.4.3 Contrast (Minimum) | AA | **Not verified** | Tailwind tokens — run axe |
| 2.1.1 Keyboard | A | **Partial** | Tab order exists; custom widgets need test |
| 2.4.1 Bypass Blocks | A | **Met** | Skip link |
| 2.4.3 Focus Order | A | **Needs test** | Complex dashboards |
| 3.3.2 Labels or Instructions | A | **Partial** | Some labels missing |
| 4.1.2 Name, Role, Value | A | **Partial** | `aria-label` used; relationships incomplete |

---

## 6. Corrective actions already implemented (examples)

1. Skip link pattern in root component template.  
2. Document language attribute on `index.html`.  
3. Widespread use of semantic layout elements in major shells.  
4. Icon-only controls often carry `aria-label`.

---

## 7. Remediation backlog (prioritized)

| Priority | Action | Owner |
|----------|--------|-------|
| P0 | Fix **all** decorative vs informative `<img>` alt decisions | Frontend |
| P0 | Add `aria-live` polite regions for async toast / chat streaming | Frontend |
| P1 | Add `aria-labelledby` for multi-field groups (date pickers, filters) | Frontend |
| P1 | Modal focus trap (`cdkTrapFocus` or equivalent) | Frontend |
| P2 | Automated **pa11y-ci** on PR | DevOps |

---

## 8. Reproducibility commands

```bash
cd frontend
npm ci
npm start   # http://localhost:4200

# In another terminal (example)
npx lighthouse http://localhost:4200/login --only-categories=accessibility --output=html --output-path=./a11y-login.html
```

---

## 9. Sign-off

Static audit completed **2026-05-04** by **Team TechNova** — **automated scores to be attached** when Lighthouse/axe runs are executed against the final deployment URL.
