from __future__ import annotations

from dataclasses import asdict
import json
from pathlib import Path
from typing import Any


class Journal:
    def __init__(self, root: str, run_id: str) -> None:
        self.root = Path(root)
        self.run_id = run_id
        self.run_dir = self.root / run_id
        self.run_dir.mkdir(parents=True, exist_ok=True)
        self.events_path = self.run_dir / "events.jsonl"
        self.summary_path = self.run_dir / "summary.json"

    def write_event(self, event_type: str, payload: dict[str, Any]) -> None:
        event = {"type": event_type, **payload}
        with self.events_path.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(event, ensure_ascii=True) + "\n")

    def write_dataclass(self, event_type: str, item: Any) -> None:
        self.write_event(event_type, asdict(item))

    def write_summary(self, summary: dict[str, Any]) -> None:
        with self.summary_path.open("w", encoding="utf-8") as handle:
            json.dump(summary, handle, indent=2, ensure_ascii=True)
