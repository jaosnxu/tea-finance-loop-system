from __future__ import annotations

from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from typing import Any
import uuid


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


@dataclass
class SkillMeta:
    name: str
    version: str
    status: str
    domain: str
    tags: list[str]
    owner: str
    entry: str
    input_schema: str
    output_schema: str
    trigger_summary: str
    priority: int
    standard_name: str = ""


@dataclass
class ConnectorMeta:
    name: str
    version: str
    status: str
    target: str
    capabilities: list[str]
    risk_level: str
    mode: str
    auth_requirements: list[str]
    entry: str
    input_schema: str
    output_schema: str
    priority: int
    standard_name: str = ""


@dataclass
class TaskRecord:
    task_id: str
    goal: str
    scope: dict[str, Any]
    acceptance: list[str]
    status: str = "created"
    current_stage: str = "intake"
    owner_runtime: str = "loop-runtime"
    created_at: str = field(default_factory=utc_now)
    updated_at: str = field(default_factory=utc_now)
    attempt_count: int = 0
    retry_count: int = 0
    active_worktrees: list[str] = field(default_factory=list)
    active_subagents: list[str] = field(default_factory=list)
    latest_report: dict[str, Any] = field(default_factory=dict)
    failure_history: list[dict[str, Any]] = field(default_factory=list)
    intent_debt: dict[str, Any] | None = None
    artifacts: list[dict[str, Any]] = field(default_factory=list)
    heartbeat_at: str = field(default_factory=utc_now)
    current_step_status: str = "pending"
    architecture: str = "graph_runtime"
    workflow_type: str = "durable_workflow"
    writer_agent: str = "writer"
    reviewer_agent: str = "reviewer"
    verifier_agent: str = "verifier"
    issue_backlog: list[dict[str, Any]] = field(default_factory=list)
    gate_status: dict[str, Any] = field(default_factory=dict)


@dataclass
class MemorySpine:
    task_memory: dict[str, Any]
    project_memory: dict[str, Any]
    system_memory: dict[str, Any]
    experience_memory: dict[str, Any]


@dataclass
class WorktreeRecord:
    worktree_id: str
    task_id: str
    parent_worktree: str | None
    path: str
    type: str
    goal: str
    scope: dict[str, Any]
    base_snapshot: str
    current_snapshot: str
    changed_files: list[str] = field(default_factory=list)
    verification_status: str = "pending"
    owner: str = "loop-runtime"
    created_at: str = field(default_factory=utc_now)
    updated_at: str = field(default_factory=utc_now)
    status: str = "active"


@dataclass
class SubAgentRecord:
    subagent_id: str
    goal: str
    scope: dict[str, Any]
    input_context: dict[str, Any]
    allowed_skills: list[str]
    allowed_connectors: list[str]
    worktree_id: str
    success_criteria: list[str]
    timebox: int
    status: str = "running"
    summary: str = ""
    artifacts: list[dict[str, Any]] = field(default_factory=list)
    findings: list[dict[str, Any]] = field(default_factory=list)
    risks: list[str] = field(default_factory=list)
    next_recommendation: str = ""
    updated_memory: dict[str, Any] = field(default_factory=dict)
    created_at: str = field(default_factory=utc_now)
    updated_at: str = field(default_factory=utc_now)


@dataclass
class RuntimeContext:
    task_record: TaskRecord
    memory: MemorySpine
    skills: list[SkillMeta]
    connectors: list[ConnectorMeta]
    primary_worktree: WorktreeRecord
    subagents: list[SubAgentRecord]
    environment: dict[str, Any]
    policy: dict[str, Any]


@dataclass
class RuntimeStepResult:
    state: str
    summary: str
    status: str = "done"
    actions: list[dict[str, Any]] = field(default_factory=list)
    artifacts: list[dict[str, Any]] = field(default_factory=list)
    next_state: str | None = None
    failure_type: str | None = None


@dataclass
class BootPayload:
    goal: str
    scope: dict[str, Any]
    acceptance: list[str]
    environment: dict[str, Any]
    policy: dict[str, Any]
    memory: dict[str, Any]
    task_id: str = field(default_factory=lambda: f"TASK-{uuid.uuid4().hex[:8].upper()}")

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "BootPayload":
        return cls(
            goal=data["goal"],
            scope=data["scope"],
            acceptance=data["acceptance"],
            environment=data["environment"],
            policy=data["policy"],
            memory=data["memory"],
            task_id=data.get("task_id", f"TASK-{uuid.uuid4().hex[:8].upper()}"),
        )

    def as_dict(self) -> dict[str, Any]:
        return asdict(self)
