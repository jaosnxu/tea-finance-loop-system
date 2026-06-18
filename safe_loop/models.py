from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any
import uuid


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


@dataclass
class RunConfig:
    project_path: str
    task: str
    command: str
    max_attempts: int = 3
    sandbox_root: str = "/private/tmp/safe-loop-runs"
    state_root: str = "/private/tmp/safe-loop-state"


@dataclass
class StepResult:
    attempt: int
    command: str
    returncode: int
    stdout: str
    stderr: str
    started_at: str
    finished_at: str
    category: str | None = None
    recovery_action: str | None = None


@dataclass
class RunRecord:
    run_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    created_at: str = field(default_factory=utc_now)
    status: str = "running"
    attempts: list[StepResult] = field(default_factory=list)
    summary: dict[str, Any] = field(default_factory=dict)
