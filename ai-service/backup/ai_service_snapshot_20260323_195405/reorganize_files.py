"""
Reorganize ai-service into core/, embeddings/, rag/, search/, generation/, utils/, tests/, docs/, etc.

Run from the ai-service directory:
    python reorganize_files.py

Creates a backup under backup/ before moving files. Does NOT move api.py, requirements.txt,
.env, seed_data.py, create_test_files.py, or reorganize_files.py.

After running, update all Python imports manually (see update_imports output).
"""
from __future__ import annotations

import os
import shutil
import sys
from datetime import datetime
from pathlib import Path

# --- File mapping (target subdir -> list of filenames) ---------------------------------

file_mapping: dict[str, list[str]] = {
    "core": [
        "config.py",
        "db_connection.py",
        "chroma_setup.py",
        "rag_service.py",
    ],
    "embeddings": [
        "embeddings_pipeline.py",
        "embeddings_pipeline_v2.py",
        "embedding_optimizer.py",
        "embedding_cache.py",
        "batch_embedding_processor.py",
    ],
    "rag": [
        "document_chunker.py",
        "rag_prompt_builder.py",
        "hallucination_guard.py",
        "context_relevance_scorer.py",
    ],
    "search": [
        "multi_document_retriever.py",
        "metadata_filter.py",
    ],
    "generation": [
        "question_generator.py",
        "brainrush_question_generator.py",
        "question_validator.py",
        "prompt_templates.py",
    ],
    "utils": [
        "langchain_ollama.py",
    ],
    "tests": [
        "test_upload.py",
        "test_rag_accuracy.py",
        "test_semantic_search.py",
        "test_sprint2_integration.py",
        "test_sprint3_integration.py",
        "test_sprint4_integration.py",
        "test_sprint5_integration.py",
        "test_upload_complete.py",
    ],
    "docs": [
        "README_SPRINT2.md",
        "README_SPRINT3.md",
        "README_SPRINT4.md",
        "README_SPRINT5.md",
        "DEMO_SCRIPT.md",
    ],
}

# Package dirs that get __init__.py (Python import roots)
PACKAGE_DIRS = (
    "core",
    "embeddings",
    "rag",
    "search",
    "generation",
    "optimization",
    "utils",
    "tests",
)

# Root files that must never be moved by this script
ROOT_KEEP = frozenset(
    {
        "api.py",
        "requirements.txt",
        ".env",
        "seed_data.py",
        "create_test_files.py",
        "reorganize_files.py",
    }
)

# Extra directories to create (no file moves defined above)
EXTRA_DIRS = ("cache", "logs")


def _base_dir() -> Path:
    return Path(__file__).resolve().parent


def _ignore_for_backup(_dir: str, names: list[str]) -> list[str]:
    return [
        n
        for n in names
        if n in ("venv", "__pycache__", ".pytest_cache", "backup", ".git")
        or n.endswith(".pyc")
    ]


def backup_files(base: Path) -> Path:
    """Copy the whole ai-service tree (except venv, backup, caches) into backup/snapshot_<ts>."""
    backup_root = base / "backup"
    backup_root.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    dest = backup_root / f"ai_service_snapshot_{stamp}"
    if dest.exists():
        raise FileExistsError(f"Backup destination already exists: {dest}")

    shutil.copytree(base, dest, ignore=_ignore_for_backup, dirs_exist_ok=False)
    print(f"[backup] Created: {dest}")
    return dest


def create_directories(base: Path) -> None:
    """Create target folders and __init__.py in each Python package."""
    all_dirs = list(PACKAGE_DIRS) + list(EXTRA_DIRS)
    for name in all_dirs:
        d = base / name
        d.mkdir(parents=True, exist_ok=True)
        print(f"[mkdir] {d.relative_to(base)}")

    init_template = '"""Package: {name}."""\n'
    for name in PACKAGE_DIRS:
        init_file = base / name / "__init__.py"
        if not init_file.exists():
            init_file.write_text(init_template.format(name=name), encoding="utf-8")
            print(f"[init] {init_file.relative_to(base)}")


def move_files(base: Path) -> dict[str, list[str]]:
    """
    Move mapped files into subdirectories.
    Returns dict: moved paths, skipped (missing), errors.
    """
    moved: list[str] = []
    skipped: list[str] = []
    errors: list[str] = []

    for subdir, files in file_mapping.items():
        target_dir = base / subdir
        target_dir.mkdir(parents=True, exist_ok=True)

        for filename in files:
            if filename in ROOT_KEEP:
                errors.append(f"Refused (root-keep): {filename}")
                continue

            src = base / filename
            dst = target_dir / filename

            if not src.is_file():
                skipped.append(f"{filename} (not found at root)")
                continue

            if dst.exists() and src.resolve() != dst.resolve():
                errors.append(f"Destination already exists: {dst}")
                continue

            try:
                shutil.move(str(src), str(dst))
                moved.append(f"{filename} -> {subdir}/")
                print(f"[move] {filename} -> {subdir}/")
            except OSError as e:
                errors.append(f"{filename}: {e}")

    return {"moved": moved, "skipped": skipped, "errors": errors}


def update_imports(base: Path) -> None:
    """Print manual import migration guide."""
    print()
    print("=" * 72)
    print("IMPORT UPDATE REQUIRED (manual)")
    print("=" * 72)
    print(
        "Python does not resolve old flat imports after moves. Update every file that\n"
        "imports moved modules — especially api.py, tests, and any cross-package code.\n"
    )

    affected: list[str] = ["api.py", "seed_data.py"]
    for subdir, files in file_mapping.items():
        for f in files:
            if f.endswith(".py"):
                affected.append(f"{subdir}/{f}")

    print("Likely affected modules (non-exhaustive):")
    for a in sorted(set(affected)):
        print(f"  - {a}")

    print("\nExample rewrites (use package imports from ai-service root on PYTHONPATH):\n")
    examples = [
        ("import config", "from core.config import ...  # or: import core.config as config"),
        ("import embeddings_pipeline_v2", "from embeddings import embeddings_pipeline_v2"),
        ("from rag_service import RAGService", "from core.rag_service import RAGService"),
        ("import document_chunker", "from rag.document_chunker import ..."),
        ("from metadata_filter import MetadataFilter", "from search.metadata_filter import MetadataFilter"),
    ]
    for old, new in examples:
        print(f"  {old}")
        print(f"    -> {new}")
        print()

    print(
        "Recommended: run ai-service as a package (pip install -e .) or set PYTHONPATH\n"
        f"to the parent of ai-service, then use absolute imports like:\n"
        f"  from ai_service.core import config  # if you rename folder to ai_service\n"
        "Or keep `sys.path.insert(0, str(Path(__file__).parent))` in api.py and use:\n"
        "  from core.config import ...\n"
    )
    print("=" * 72)


def main() -> int:
    base = _base_dir()
    os.chdir(base)

    print("ai-service reorganization")
    print(f"Base directory: {base}")
    print()
    print("This script will:")
    print("  1. Create a full tree backup under backup/")
    print("  2. Create subdirectories and __init__.py files")
    print("  3. Move mapped .py/.md files from root into those folders")
    print()
    print("Will NOT move:", ", ".join(sorted(ROOT_KEEP)))
    print()

    resp = input("Type yes to proceed, or anything else to abort: ").strip().lower()
    if resp != "yes":
        print("Aborted.")
        return 1

    try:
        backup_path = backup_files(base)
    except Exception as e:
        print(f"[backup] FAILED: {e}")
        return 2

    try:
        create_directories(base)
    except Exception as e:
        print(f"[mkdir] FAILED: {e}")
        return 3

    result = move_files(base)

    print()
    print("-" * 72)
    print("SUMMARY")
    print("-" * 72)
    print(f"Backup location: {backup_path}")
    print(f"Files moved: {len(result['moved'])}")
    if result["skipped"]:
        print(f"Skipped ({len(result['skipped'])}):")
        for s in result["skipped"]:
            print(f"  - {s}")
    if result["errors"]:
        print(f"Errors ({len(result['errors'])}):")
        for e in result["errors"]:
            print(f"  - {e}")
        return 4

    update_imports(base)

    print()
    print("Next steps:")
    print("  1. Update imports in api.py, tests, and all internal modules.")
    print("  2. Optionally move log paths in code to logs/ and cache to cache/.")
    print("  3. Run: python -m py_compile api.py && pytest tests/ -q")
    print()

    return 0


if __name__ == "__main__":
    sys.exit(main())
