from __future__ import annotations

import json
from dataclasses import asdict
from pathlib import Path

from .models import TaskRecord
from .observability import build_run_report


class TaskStore:
    def __init__(self, root: str, task_id: str) -> None:
        self.root = Path(root) / task_id
        self.root.mkdir(parents=True, exist_ok=True)
        self.path = self.root / "task_record.json"
        self.reports_path = self.root / "reports.jsonl"
        self.trace_path = self.root / "trace.jsonl"
        self.run_report_path = self.root / "run_report.json"

    def save(self, record: TaskRecord) -> None:
        self.path.write_text(json.dumps(asdict(record), indent=2, ensure_ascii=True), encoding="utf-8")

    def exists(self) -> bool:
        return self.path.exists()

    def load(self) -> TaskRecord:
        payload = json.loads(self.path.read_text(encoding="utf-8"))
        return TaskRecord(**payload)

    def append_report(self, report: dict) -> None:
        with self.reports_path.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(report, ensure_ascii=True) + "\n")

    def write_heartbeat(self, payload: dict) -> None:
        heartbeat_path = self.root / "heartbeat.json"
        heartbeat_path.write_text(json.dumps(payload, indent=2, ensure_ascii=True), encoding="utf-8")

    def append_trace(self, event: dict) -> None:
        with self.trace_path.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(event, ensure_ascii=True) + "\n")

    def read_reports(self) -> list[dict]:
        return self._read_jsonl(self.reports_path)

    def read_trace(self) -> list[dict]:
        return self._read_jsonl(self.trace_path)

    def write_run_report(self, record: TaskRecord) -> dict:
        report = build_run_report(
            record,
            reports_count=len(self.read_reports()),
            trace_count=len(self.read_trace()),
        )
        self.run_report_path.write_text(json.dumps(report, indent=2, ensure_ascii=True), encoding="utf-8")
        return report

    def _read_jsonl(self, path: Path) -> list[dict]:
        if not path.exists():
            return []
        rows = []
        for line in path.read_text(encoding="utf-8").splitlines():
            if line.strip():
                rows.append(json.loads(line))
        return rows
