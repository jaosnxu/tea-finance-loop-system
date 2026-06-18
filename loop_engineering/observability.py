from __future__ import annotations

from .models import TaskRecord


def build_run_report(record: TaskRecord, reports_count: int = 0, trace_count: int = 0) -> dict:
    artifact_types = _count_artifact_types(record.artifacts)
    failed_gates = [
        name
        for name, status in record.gate_status.items()
        if isinstance(status, dict) and status.get("status") not in {"approved", "verified", "passed"}
    ]
    return {
        "task_id": record.task_id,
        "goal": record.goal,
        "status": record.status,
        "current_stage": record.current_stage,
        "architecture": record.architecture,
        "workflow_type": record.workflow_type,
        "attempt_count": record.attempt_count,
        "retry_count": record.retry_count,
        "heartbeat_at": record.heartbeat_at,
        "issue_count": len(record.issue_backlog),
        "active_worktrees": record.active_worktrees,
        "active_subagents": record.active_subagents,
        "gate_status": record.gate_status,
        "failed_gates": failed_gates,
        "failure_count": len(record.failure_history),
        "intent_debt": record.intent_debt,
        "artifact_types": artifact_types,
        "reports_count": reports_count,
        "trace_count": trace_count,
    }


def _count_artifact_types(artifacts: list[dict]) -> dict[str, int]:
    counts: dict[str, int] = {}
    for artifact in artifacts:
        artifact_type = str(artifact.get("type", "unknown"))
        counts[artifact_type] = counts.get(artifact_type, 0) + 1
    return counts
