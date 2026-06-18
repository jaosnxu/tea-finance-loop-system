from __future__ import annotations

import json
from dataclasses import asdict
from pathlib import Path
import uuid

from .models import SubAgentRecord, utc_now


class SubAgentStore:
    def __init__(self, root: str, task_id: str) -> None:
        self.root = Path(root) / task_id / "subagents"
        self.root.mkdir(parents=True, exist_ok=True)

    def save(self, record: SubAgentRecord) -> None:
        record.updated_at = utc_now()
        path = self.root / f"{record.subagent_id}.json"
        path.write_text(json.dumps(asdict(record), indent=2, ensure_ascii=True), encoding="utf-8")

    def load_many(self, subagent_ids: list[str]) -> list[SubAgentRecord]:
        records = []
        for subagent_id in subagent_ids:
            path = self.root / f"{subagent_id}.json"
            if path.exists():
                records.append(SubAgentRecord(**json.loads(path.read_text(encoding="utf-8"))))
        return records


class SubAgentManager:
    def __init__(self, store: SubAgentStore) -> None:
        self.store = store

    def spawn(
        self,
        *,
        goal: str,
        scope: dict,
        input_context: dict,
        allowed_skills: list[str],
        allowed_connectors: list[str],
        worktree_id: str,
        success_criteria: list[str],
        timebox: int = 1,
    ) -> SubAgentRecord:
        record = SubAgentRecord(
            subagent_id=f"SA-{uuid.uuid4().hex[:8].upper()}",
            goal=goal,
            scope=scope,
            input_context=input_context,
            allowed_skills=allowed_skills,
            allowed_connectors=allowed_connectors,
            worktree_id=worktree_id,
            success_criteria=success_criteria,
            timebox=timebox,
        )
        self.store.save(record)
        return record

    def run(self, record: SubAgentRecord) -> SubAgentRecord:
        record.status = "completed"
        record.summary = "Sub-agent completed scoped analysis task."
        record.artifacts = [
            {"type": "subagent_scope", "value": record.scope},
            {"type": "subagent_goal", "value": record.goal},
        ]
        record.findings = [
            {"type": "subagent_finding", "value": "Scoped task is ready to merge back into parent runtime."}
        ]
        record.next_recommendation = "Merge sub-agent findings into parent task memory."
        record.updated_memory = {
            "subagent_result": {
                "subagent_id": record.subagent_id,
                "summary": record.summary,
            }
        }
        self.store.save(record)
        return record
