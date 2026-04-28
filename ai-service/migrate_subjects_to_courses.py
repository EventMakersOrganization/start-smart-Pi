"""
Backfill chapter/subchapter structure from `subjects` into `courses`.

Design assumption:
- One Mongo `courses` document represents one chapter.
- `courses.subject` identifies the parent subject/program.
- This script copies the corresponding chapter's subChapters into `courses.subChapters`.

Usage:
  python migrate_subjects_to_courses.py --dry-run
  python migrate_subjects_to_courses.py --apply
"""

from __future__ import annotations

import argparse
import re
import unicodedata
from datetime import datetime, timezone

from pymongo import MongoClient

from core import config


def _norm(text: str) -> str:
    t = str(text or "").strip().lower()
    t = unicodedata.normalize("NFD", t)
    t = "".join(ch for ch in t if unicodedata.category(ch) != "Mn")
    return " ".join(t.split())


def _first_num(text: str) -> int | None:
    m = re.search(r"\b(\d{1,3})\b", str(text or ""))
    return int(m.group(1)) if m else None


def _chapter_payload(ch: dict) -> dict:
    sub = ch.get("subChapters") or ch.get("subchapters") or []
    out_sub = []
    for i, sc in enumerate(sub):
        if not isinstance(sc, dict):
            continue
        out_sub.append(
            {
                "title": str(sc.get("title") or "").strip(),
                "description": str(sc.get("description") or "").strip(),
                "order": int(sc.get("order") or i + 1),
                "contents": list(sc.get("contents") or []),
            }
        )
    return {
        "chapterTitle": str(ch.get("title") or "").strip(),
        "chapterOrder": int(ch.get("order") or 0),
        "subChapters": out_sub,
    }


def _pick_best_course(chapter: dict, courses: list[dict]) -> dict | None:
    if not courses:
        return None
    ch_title_n = _norm(chapter.get("title") or "")
    ch_num = _first_num(chapter.get("title") or "")
    scored: list[tuple[int, dict]] = []
    for c in courses:
        ct = str(c.get("title") or "")
        ct_n = _norm(ct)
        score = 0
        if ch_title_n and ct_n and (ch_title_n in ct_n or ct_n in ch_title_n):
            score += 3
        c_num = _first_num(ct)
        if ch_num is not None and c_num is not None and ch_num == c_num:
            score += 2
        score += 1 if ct_n else 0
        scored.append((score, c))
    scored.sort(key=lambda x: x[0], reverse=True)
    return scored[0][1] if scored and scored[0][0] > 0 else None


def run(apply: bool) -> None:
    client = MongoClient(config.MONGODB_URI)
    db = client[config.MONGODB_DB_NAME]
    subjects = list(db["subjects"].find({}))
    courses = list(db["courses"].find({}))

    by_subject: dict[str, list[dict]] = {}
    for c in courses:
        key = _norm(c.get("subject") or "")
        by_subject.setdefault(key, []).append(c)

    matched = 0
    updated = 0
    missing = 0

    for subj in subjects:
        s_title = str(subj.get("title") or "").strip()
        s_key = _norm(s_title)
        subject_courses = by_subject.get(s_key, [])
        chapters = subj.get("chapters") or []

        for ch in chapters:
            if not isinstance(ch, dict):
                continue
            course_doc = _pick_best_course(ch, subject_courses)
            if not course_doc:
                missing += 1
                print(f"[MISS] subject='{s_title}' chapter='{ch.get('title','')}' (no course match)")
                continue

            matched += 1
            payload = _chapter_payload(ch)
            set_doc = {
                "subjectId": str(subj.get("_id")),
                "chapterTitle": payload["chapterTitle"],
                "chapterOrder": payload["chapterOrder"],
                "subChapters": payload["subChapters"],
                "subjectSyncAt": datetime.now(timezone.utc),
            }

            print(
                f"[MATCH] subject='{s_title}' chapter='{payload['chapterTitle']}' "
                f"-> course='{course_doc.get('title','')}' subChapters={len(payload['subChapters'])}"
            )
            if apply:
                db["courses"].update_one(
                    {"_id": course_doc["_id"]},
                    {"$set": set_doc, "$unset": {"modules": ""}},
                )
                updated += 1

    print(
        f"\nDone. subjects={len(subjects)} courses={len(courses)} "
        f"matched={matched} missing={missing} updated={updated} apply={apply}"
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true", help="Persist updates to courses")
    parser.add_argument("--dry-run", action="store_true", help="Preview only (default)")
    args = parser.parse_args()
    apply = bool(args.apply and not args.dry_run)
    run(apply=apply)


if __name__ == "__main__":
    main()

