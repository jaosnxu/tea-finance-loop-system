from __future__ import annotations

from .models import TaskRecord

TERMINAL_STATUSES = {"completed", "blocked", "aborted"}


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
        "repair_count": record.repair_count,
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


def build_run_summary(record: TaskRecord, reports: list[dict] | None = None, trace_count: int = 0) -> dict:
    reports = reports or []
    project_memory = _latest_artifact(record.artifacts, "project_memory_index_context") or {}
    ci_summary = _latest_artifact(record.artifacts, "ci_suite_summary")
    ci_setup = _latest_artifact(record.artifacts, "ci_setup_result")
    eval_summary = _latest_artifact(record.artifacts, "eval_summary")
    return {
        "schema_version": "loop.run_summary.v1",
        "task_id": record.task_id,
        "goal": record.goal,
        "scope": record.scope,
        "acceptance": record.acceptance,
        "status": record.status,
        "current_stage": record.current_stage,
        "created_at": record.created_at,
        "updated_at": record.updated_at,
        "heartbeat_at": record.heartbeat_at,
        "attempt_count": record.attempt_count,
        "retry_count": record.retry_count,
        "repair_count": record.repair_count,
        "workflow": {
            "architecture": record.architecture,
            "type": record.workflow_type,
            "writer": record.writer_agent,
            "reviewer": record.reviewer_agent,
            "verifier": record.verifier_agent,
        },
        "project_memory_index": {
            "root": project_memory.get("root"),
            "index_path": project_memory.get("index_path"),
            "status": project_memory.get("status"),
            "loaded_files": project_memory.get("loaded_files", []),
            "missing_files": project_memory.get("missing_files", []),
            "rejected_files": project_memory.get("rejected_files", []),
        },
        "stages": [
            {
                "stage": report.get("stage"),
                "status": report.get("status"),
                "summary": report.get("summary"),
                "failure_type": report.get("failure_type"),
                "next_state": report.get("next_state"),
                "timestamp": report.get("timestamp"),
            }
            for report in reports
        ],
        "gates": record.gate_status,
        "issues": {
            "count": len(record.issue_backlog),
            "items": record.issue_backlog,
        },
        "failures": record.failure_history,
        "intent_debt": record.intent_debt,
        "repair_queue": _repair_queue_hint(record),
        "verification": {
            "ci_setup": ci_setup,
            "ci_summary": ci_summary,
            "eval_summary": eval_summary,
            "artifact_types": _count_artifact_types(record.artifacts),
            "reports_count": len(reports),
            "trace_count": trace_count,
        },
        "worktrees": record.active_worktrees,
        "subagents": record.active_subagents,
        "next_action": _next_action(record),
    }


def _count_artifact_types(artifacts: list[dict]) -> dict[str, int]:
    counts: dict[str, int] = {}
    for artifact in artifacts:
        artifact_type = str(artifact.get("type", "unknown"))
        counts[artifact_type] = counts.get(artifact_type, 0) + 1
    return counts


def _latest_artifact(artifacts: list[dict], artifact_type: str) -> dict | None:
    for artifact in reversed(artifacts):
        if artifact.get("type") == artifact_type:
            value = artifact.get("value")
            return value if isinstance(value, dict) else artifact
    return None


def _next_action(record: TaskRecord) -> str:
    if record.status == "completed":
        return "No further action required unless a new task is opened."
    if record.status == "blocked":
        if record.intent_debt:
            return str(record.intent_debt.get("next_step") or "Resolve recorded intent debt before retrying.")
        return "Inspect failed gates or failure history before retrying."
    if record.current_stage:
        return f"Continue from stage {record.current_stage}."
    return "Inspect task record before continuing."


def _repair_queue_hint(record: TaskRecord) -> dict:
    if record.status != "blocked" or not record.intent_debt:
        return {"queued": False}
    failure_type = str(record.intent_debt.get("failure_type") or "unknown")
    return {
        "queued": True,
        "failure_type": failure_type,
        "queue_class": _queue_class(failure_type),
        "next_step": record.intent_debt.get("next_step"),
    }


def _queue_class(failure_type: str) -> str:
    if failure_type == "code_error":
        return "automated_repair"
    if failure_type in {"network_error", "timeout"}:
        return "delayed_retry"
    if failure_type == "production_risk":
        return "approval_required"
    if failure_type in {"permission_error", "auth_error", "configuration_error", "requirement_ambiguity"}:
        return "human_blocked"
    return "needs_triage"
