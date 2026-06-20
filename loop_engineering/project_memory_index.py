from __future__ import annotations

from pathlib import Path
import re
from typing import Any


MEMORY_INDEX_PATTERN = re.compile(r"`([^`]+)`")


def load_project_memory_index(
    project_root: str | Path,
    *,
    index_path: str = "docs/loop/00_MEMORY_INDEX.md",
    recent_limit: int = 3,
) -> dict[str, Any]:
    root = Path(project_root).resolve()
    index = _resolve_inside_root(root, index_path)
    if index is None:
        return {
            "root": str(root),
            "index_path": str(root / index_path),
            "status": "rejected",
            "files": {},
            "loaded_files": [],
            "missing_files": [],
            "rejected_files": [index_path],
        }
    if not index.exists():
        return {
            "root": str(root),
            "index_path": str(index),
            "status": "missing",
            "files": {},
            "loaded_files": [],
            "missing_files": [index_path],
            "rejected_files": [],
        }

    files: dict[str, str] = {index_path: index.read_text(encoding="utf-8")}
    missing_files: list[str] = []
    rejected_files: list[str] = []
    for requested_path in _extract_index_paths(files[index_path]):
        if not _is_safe_project_path(root, requested_path):
            rejected_files.append(requested_path)
            continue
        if _is_glob(requested_path):
            matches = sorted(root.glob(requested_path))
            selected = matches[-recent_limit:]
            if not selected:
                missing_files.append(requested_path)
                continue
            for path in selected:
                safe_path = _resolve_inside_root(root, path)
                if safe_path and safe_path.is_file():
                    files[str(safe_path.relative_to(root))] = safe_path.read_text(encoding="utf-8")
            continue

        path = _resolve_inside_root(root, requested_path)
        if path.exists() and path.is_file():
            files[str(path.relative_to(root))] = path.read_text(encoding="utf-8")
        else:
            missing_files.append(requested_path)

    return {
        "root": str(root),
        "index_path": str(index),
        "status": "available",
        "files": files,
        "loaded_files": sorted(files.keys()),
        "missing_files": missing_files,
        "rejected_files": rejected_files,
    }


def _extract_index_paths(markdown: str) -> list[str]:
    paths: list[str] = []
    for line in markdown.splitlines():
        for item in MEMORY_INDEX_PATTERN.findall(line):
            if item.endswith(".md") or "*" in item:
                paths.append(item)
    return paths


def _is_glob(path: str) -> bool:
    return any(marker in path for marker in ["*", "?", "["])


def _is_safe_project_path(root: Path, requested_path: str) -> bool:
    if Path(requested_path).is_absolute():
        return False
    if _is_glob(requested_path):
        static_prefix = _glob_static_prefix(requested_path)
        return _resolve_inside_root(root, static_prefix or ".") is not None
    return _resolve_inside_root(root, requested_path) is not None


def _glob_static_prefix(path: str) -> str:
    parts = Path(path).parts
    safe_parts: list[str] = []
    for part in parts:
        if _is_glob(part):
            break
        safe_parts.append(part)
    return str(Path(*safe_parts)) if safe_parts else "."


def _resolve_inside_root(root: Path, requested_path: str | Path) -> Path | None:
    path = Path(requested_path)
    if path.is_absolute():
        resolved = path.resolve()
    else:
        resolved = (root / path).resolve()
    try:
        resolved.relative_to(root)
    except ValueError:
        return None
    return resolved
