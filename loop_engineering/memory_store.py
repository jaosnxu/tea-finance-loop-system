from __future__ import annotations

import json
from dataclasses import asdict
from pathlib import Path
import uuid

from .models import MemorySpine


class MemoryStore:
    def __init__(self, namespace_root: str, namespace: str) -> None:
        self.root = Path(namespace_root) / namespace
        self.root.mkdir(parents=True, exist_ok=True)
        self.path = self.root / "memory.json"

    def initialize(self) -> MemorySpine:
        if self.path.exists():
            return self.load()
        memory = MemorySpine(
            task_memory={},
            project_memory={},
            system_memory={},
            experience_memory={},
        )
        self.save(memory)
        return memory

    def load(self) -> MemorySpine:
        payload = json.loads(self.path.read_text(encoding="utf-8"))
        return MemorySpine(**payload)

    def save(self, memory: MemorySpine) -> None:
        self.path.write_text(json.dumps(asdict(memory), indent=2, ensure_ascii=True), encoding="utf-8")

    def add_success(self, memory: MemorySpine, *, pattern: str, context: dict, outcome: str, recommendation: str) -> None:
        successes = memory.experience_memory.setdefault("successes", [])
        successes.append(
            {
                "id": f"EXP-{uuid.uuid4().hex[:8].upper()}",
                "pattern": pattern,
                "context": context,
                "outcome": outcome,
                "recommendation": recommendation,
            }
        )

    def add_failure(self, memory: MemorySpine, *, pattern: str, context: dict, outcome: str, recommendation: str) -> None:
        failures = memory.experience_memory.setdefault("failures", [])
        failures.append(
            {
                "id": f"EXP-{uuid.uuid4().hex[:8].upper()}",
                "pattern": pattern,
                "context": context,
                "outcome": outcome,
                "recommendation": recommendation,
            }
        )

    def search_experience(self, memory: MemorySpine, *, pattern: str | None = None, outcome: str | None = None) -> dict:
        successes = memory.experience_memory.get("successes", [])
        failures = memory.experience_memory.get("failures", [])
        if pattern:
            successes = [item for item in successes if pattern in item.get("pattern", "")]
            failures = [item for item in failures if pattern in item.get("pattern", "")]
        if outcome:
            successes = [item for item in successes if outcome in item.get("outcome", "")]
            failures = [item for item in failures if outcome in item.get("outcome", "")]
        return {"successes": successes, "failures": failures}
