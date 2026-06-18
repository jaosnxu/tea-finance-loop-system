from __future__ import annotations

import json
import shutil
from dataclasses import asdict
from pathlib import Path
import uuid

from .models import WorktreeRecord, utc_now


IGNORE_NAMES = shutil.ignore_patterns(
    ".git",
    ".next",
    "node_modules",
    "__pycache__",
    ".DS_Store",
    "*.tsbuildinfo",
)


class WorktreeManager:

    def __init__(self, root: str, task_id: str) -> None:
        self.root = Path(root) / task_id
        self.root.mkdir(parents=True, exist_ok=True)
        self.records_dir = self.root / "records"
        self.records_dir.mkdir(parents=True, exist_ok=True)

    def create_primary(self, goal: str, scope: dict, source_path: str | None = None) -> WorktreeRecord:
        worktree_id = f"WT-{uuid.uuid4().hex[:8].upper()}"
        worktree_dir = self.root / worktree_id
        if source_path:
            src = Path(source_path)
            if src.exists():
                shutil.copytree(src, worktree_dir, ignore=IGNORE_NAMES)
            else:
                worktree_dir.mkdir(parents=True, exist_ok=True)
        else:
            worktree_dir.mkdir(parents=True, exist_ok=True)
        record = WorktreeRecord(
            worktree_id=worktree_id,
            task_id=self.root.name,
            parent_worktree=None,
            path=str(worktree_dir),
            type="primary",
            goal=goal,
            scope=scope,
            base_snapshot=utc_now(),
            current_snapshot=utc_now(),
        )
        self.save(record)
        return record

    def save(self, record: WorktreeRecord) -> None:
        path = self.records_dir / f"{record.worktree_id}.json"
        record.updated_at = utc_now()
        path.write_text(json.dumps(asdict(record), indent=2, ensure_ascii=True), encoding="utf-8")

    def load(self, worktree_id: str) -> WorktreeRecord:
        path = self.records_dir / f"{worktree_id}.json"
        payload = json.loads(path.read_text(encoding="utf-8"))
        return WorktreeRecord(**payload)
