from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from .models import utc_now


REQUIRED_MEMORY_FILES = {
    "README.md": """# Repository Memory

This directory is the durable memory spine for Loop Engineering.

Rules:
- Read this directory before planning or execution.
- Record every Loop stage result in `action_log.jsonl`.
- Persist repair queue state in `repair_queue.jsonl` with `open`, `claimed`, `resolved`, and `failed` rows.
- Keep project status, standards, decisions, integrations, and open questions current.
- Store reusable experience in `experience/successes.jsonl` and `experience/failures.jsonl`.
""",
    "project_context.md": """# Project Context

This repository is managed by Loop Engineering.

Fill this file with the target project's product goal, business boundary, technical boundary, and current stage before using it as a long-term project memory source.
""",
    "project_status.md": """# Project Status

Current source of truth:
- Repository: unset
- Current phase: unset
- Active branch or PR: unset
- Required gates: lint, typecheck, test, build-smoke, audit

Update this file whenever a project milestone changes.
""",
    "project_standards.md": """# Project Standards

Loop standards:
- Fixed workflow before autonomy.
- Each step has status, heartbeat, timeout, retry policy, review, and verification.
- Network failures can retry automatically.
- Code failures enter self-repair cycles before intent debt.
- Exhausted self-repair creates repair queue items for future automatic resume.
- Repair queue items must be schedulable, claimable, and closed as resolved or failed.
- Human intervention must go through approval requests, not informal chat-only approval.
- Tool policy must separate allowed tools, high-risk tools, and production writes.
- Eval cases and regression candidates must be used to prevent repeated platform failures.
- Auth, permission, production config, or unclear requirement failures become blocked intent debt.
- Writer, reviewer, and verifier gates must remain separate in records.
- Every action must be written outside conversation memory.
""",
    "decisions.md": """# Decisions

- The repository is the long-term memory source for Loop.
- Runtime task records remain external, but project-level memory is committed in the repository.
- Project-specific decisions must be recorded here when they affect implementation, testing, release, or product scope.
""",
    "open_questions.md": """# Open Questions

- Record unresolved business, technical, permission, integration, or production-risk questions here.
""",
    "integration_state.md": """# Integration State

GitHub:
- Repository: unset
- Default branch: main

External design:
- Figma file key: unset

Runtime:
- Local task records: /private/tmp/loop-task-records
- Local worktrees: /private/tmp/loop-worktrees
""",
    "projects/loop-engineering.md": """# Loop Engineering Project Record

Purpose:
- Reusable development execution system.

Required behavior:
- File-based skills.
- File-based connectors.
- Code-based subagents.
- Memory spine retrieval and experience reuse.
- MCP, CLI, GitHub, Figma, Product Design, browser, git, and test connector routing.
""",
    "projects/default-project.md": """# Project Record

Purpose:
- Fill with this project's business and technical purpose.

Current boundary:
- Fill with current phase scope.

Deferred:
- Fill with explicit non-goals and deferred work.
""",
    "backlog/loop-engineering.json": """{
  "project": "loop-engineering",
  "updated_at": "2026-06-18",
  "items": []
}
""",
    "backlog/default-project.json": """{
  "project": "default-project",
  "updated_at": "2026-06-18",
  "items": []
}
""",
    "verification/ui_acceptance.md": """# UI Acceptance Standard

Define browser verification before production release.
""",
    "verification/regression_policy.md": """# Regression Policy

Failures should become regression candidates and tests.
""",
    "verification/production_risk_policy.md": """# Production Risk Policy

Production writes require explicit human approval.
""",
}


class RepositoryMemory:
    def __init__(self, root: str | Path) -> None:
        self.root = Path(root)
        self.action_log_path = self.root / "action_log.jsonl"
        self.intent_debt_path = self.root / "intent_debt.jsonl"
        self.repair_queue_path = self.root / "repair_queue.jsonl"
        self.approval_request_path = self.root / "approval_requests.jsonl"
        self.regression_candidate_path = self.root / "regression_candidates.jsonl"
        self.current_status_path = self.root / "current_status.json"
        self.run_history_path = self.root / "run_history.jsonl"
        self.success_log_path = self.root / "experience" / "successes.jsonl"
        self.failure_log_path = self.root / "experience" / "failures.jsonl"

    def initialize(self) -> None:
        self.root.mkdir(parents=True, exist_ok=True)
        (self.root / "projects").mkdir(parents=True, exist_ok=True)
        (self.root / "backlog").mkdir(parents=True, exist_ok=True)
        (self.root / "verification").mkdir(parents=True, exist_ok=True)
        (self.root / "runs").mkdir(parents=True, exist_ok=True)
        (self.root / "experience").mkdir(parents=True, exist_ok=True)
        for relative_path, default_content in REQUIRED_MEMORY_FILES.items():
            path = self.root / relative_path
            if not path.exists():
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text(default_content, encoding="utf-8")
        for path in [
            self.action_log_path,
            self.intent_debt_path,
            self.repair_queue_path,
            self.approval_request_path,
            self.regression_candidate_path,
            self.run_history_path,
            self.success_log_path,
            self.failure_log_path,
        ]:
            if not path.exists():
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text("", encoding="utf-8")
        if not self.current_status_path.exists():
            self.current_status_path.write_text(
                json.dumps(
                    {
                        "updated_at": utc_now(),
                        "active_task_id": None,
                        "active_goal": None,
                        "status": "initialized",
                        "current_stage": None,
                        "last_summary": "Repository memory initialized.",
                    },
                    indent=2,
                    ensure_ascii=True,
                ),
                encoding="utf-8",
            )

    def read_required_context(self, *, recent_actions: int = 20) -> dict[str, Any]:
        self.initialize()
        files = {}
        for relative_path in REQUIRED_MEMORY_FILES:
            path = self.root / relative_path
            files[relative_path] = path.read_text(encoding="utf-8")
        return {
            "root": str(self.root),
            "files": files,
            "recent_actions": self._read_jsonl_tail(self.action_log_path, recent_actions),
            "recent_intent_debt": self._read_jsonl_tail(self.intent_debt_path, recent_actions),
            "recent_repair_queue": self._read_jsonl_tail(self.repair_queue_path, recent_actions),
            "open_repair_queue": self.list_repair_items(status="open", limit=recent_actions),
            "claimable_repair_queue": self.list_repair_items(
                status="open",
                queue_classes={"automated_repair", "delayed_retry"},
                limit=recent_actions,
            ),
            "recent_approval_requests": self._read_jsonl_tail(self.approval_request_path, recent_actions),
            "open_approval_requests": self.list_approval_requests(status="open", limit=recent_actions),
            "recent_regression_candidates": self._read_jsonl_tail(self.regression_candidate_path, recent_actions),
            "recent_run_summaries": self._read_jsonl_tail(self.run_history_path, recent_actions),
            "recent_successes": self._read_jsonl_tail(self.success_log_path, recent_actions),
            "recent_failures": self._read_jsonl_tail(self.failure_log_path, recent_actions),
            "current_status": json.loads(self.current_status_path.read_text(encoding="utf-8")),
        }

    def search_actions(
        self,
        *,
        task_id: str | None = None,
        stage: str | None = None,
        status: str | None = None,
        limit: int = 20,
    ) -> list[dict[str, Any]]:
        self.initialize()
        rows = self._read_jsonl_tail(self.action_log_path, 10000)
        if task_id:
            rows = [row for row in rows if row.get("task_id") == task_id]
        if stage:
            rows = [row for row in rows if row.get("stage") == stage]
        if status:
            rows = [row for row in rows if row.get("status") == status]
        return rows[-limit:]

    def append_action(
        self,
        *,
        task_id: str,
        goal: str,
        stage: str,
        status: str,
        summary: str,
        next_state: str | None,
        failure_type: str | None,
        actions: list[dict[str, Any]],
        artifacts: list[dict[str, Any]],
    ) -> None:
        self.initialize()
        row = {
            "timestamp": utc_now(),
            "task_id": task_id,
            "goal": goal,
            "stage": stage,
            "status": status,
            "summary": summary,
            "next_state": next_state,
            "failure_type": failure_type,
            "actions": actions,
            "artifact_types": [artifact.get("type") for artifact in artifacts],
        }
        self._append_jsonl(self.action_log_path, row)

    def write_run_status(
        self,
        *,
        task_id: str,
        goal: str,
        status: str,
        current_stage: str,
        last_summary: str,
        gate_status: dict[str, Any],
        issue_count: int,
        failure_count: int,
        intent_debt: dict[str, Any] | None,
    ) -> None:
        self.initialize()
        row = {
            "updated_at": utc_now(),
            "active_task_id": task_id,
            "active_goal": goal,
            "status": status,
            "current_stage": current_stage,
            "last_summary": last_summary,
            "gate_status": gate_status,
            "issue_count": issue_count,
            "failure_count": failure_count,
            "intent_debt": intent_debt,
        }
        self.current_status_path.write_text(json.dumps(row, indent=2, ensure_ascii=True), encoding="utf-8")
        run_path = self.root / "runs" / f"{task_id}.json"
        run_path.write_text(json.dumps(row, indent=2, ensure_ascii=True), encoding="utf-8")

    def archive_run_summary(self, summary: dict[str, Any]) -> None:
        self.initialize()
        task_id = summary["task_id"]
        run_path = self.root / "runs" / f"{task_id}.json"
        run_path.write_text(json.dumps(summary, indent=2, ensure_ascii=True), encoding="utf-8")
        if summary.get("status") in {"completed", "blocked", "aborted"} and not self._run_history_contains(task_id):
            self._append_jsonl(
                self.run_history_path,
                {
                    "timestamp": utc_now(),
                    "task_id": task_id,
                    "goal": summary.get("goal"),
                    "status": summary.get("status"),
                    "current_stage": summary.get("current_stage"),
                    "failure_count": len(summary.get("failures") or []),
                    "intent_debt": summary.get("intent_debt"),
                    "next_action": summary.get("next_action"),
                    "summary_path": str(run_path),
                },
            )

    def append_intent_debt(self, *, task_id: str, debt: dict[str, Any]) -> None:
        self.initialize()
        self._append_jsonl(
            self.intent_debt_path,
            {
                "timestamp": utc_now(),
                "task_id": task_id,
                "debt": debt,
            },
        )

    def create_approval_request(
        self,
        *,
        task_id: str,
        approval_type: str,
        subject: str,
        reason: str,
        risk_level: str,
    ) -> dict[str, Any]:
        self.initialize()
        approval_id = f"{task_id}:{approval_type}:{subject}"
        existing = self._latest_approval_request(approval_id)
        if existing and existing.get("status") == "open":
            return existing
        row = {
            "timestamp": utc_now(),
            "approval_id": approval_id,
            "task_id": task_id,
            "approval_type": approval_type,
            "subject": subject,
            "reason": reason,
            "risk_level": risk_level,
            "status": "open",
        }
        self._append_jsonl(self.approval_request_path, row)
        return row

    def list_approval_requests(self, *, status: str | None = None, limit: int = 20) -> list[dict[str, Any]]:
        self.initialize()
        rows = self._read_jsonl_tail(self.approval_request_path, 10000)
        latest_by_id: dict[str, dict[str, Any]] = {}
        order: list[str] = []
        for row in rows:
            approval_id = str(row.get("approval_id") or "")
            if not approval_id:
                continue
            if approval_id not in latest_by_id:
                order.append(approval_id)
            latest_by_id[approval_id] = row
        items = [latest_by_id[approval_id] for approval_id in order if approval_id in latest_by_id]
        if status is not None:
            items = [item for item in items if item.get("status") == status]
        return items[-limit:]

    def resolve_approval_request(
        self,
        *,
        approval_id: str,
        status: str,
        resolved_by: str,
        resolution_note: str,
    ) -> dict[str, Any] | None:
        if status not in {"approved", "rejected"}:
            raise ValueError("approval status must be approved or rejected")
        self.initialize()
        item = self._latest_approval_request(approval_id)
        if not item:
            return None
        resolved = {
            **item,
            "timestamp": utc_now(),
            "status": status,
            "resolved_by": resolved_by,
            "resolution_note": resolution_note,
        }
        self._append_jsonl(self.approval_request_path, resolved)
        return resolved

    def enqueue_repair(
        self,
        *,
        task_id: str,
        goal: str,
        failure_type: str,
        reason: str,
        next_step: str,
        repair_count: int,
        retry_count: int,
    ) -> None:
        self.initialize()
        if self._repair_queue_contains(task_id):
            return
        self._append_jsonl(
            self.repair_queue_path,
            {
                "timestamp": utc_now(),
                "source_task_id": task_id,
                "queue_item_id": task_id,
                "goal": goal,
                "status": "open",
                "failure_type": failure_type,
                "reason": reason,
                "repair_count": repair_count,
                "retry_count": retry_count,
                "queue_class": _queue_class(failure_type),
                "resume_strategy": _resume_strategy(failure_type),
                "next_step": next_step,
            },
        )

    def list_repair_items(
        self,
        *,
        status: str | None = None,
        queue_classes: set[str] | None = None,
        limit: int = 20,
    ) -> list[dict[str, Any]]:
        self.initialize()
        rows = self._read_jsonl_tail(self.repair_queue_path, 10000)
        latest_by_source: dict[str, dict[str, Any]] = {}
        order: list[str] = []
        for row in rows:
            source_task_id = str(row.get("source_task_id") or row.get("queue_item_id") or "")
            if not source_task_id:
                continue
            if source_task_id not in latest_by_source:
                order.append(source_task_id)
            latest_by_source[source_task_id] = row
        items = [latest_by_source[source_task_id] for source_task_id in order if source_task_id in latest_by_source]
        if status is not None:
            items = [item for item in items if item.get("status") == status]
        if queue_classes is not None:
            items = [item for item in items if item.get("queue_class") in queue_classes]
        return items[-limit:]

    def next_claimable_repair_item(self) -> dict[str, Any] | None:
        items = self.list_repair_items(
            status="open",
            queue_classes={"automated_repair", "delayed_retry"},
            limit=1,
        )
        return items[0] if items else None

    def claim_repair_item(self, *, source_task_id: str, worker_task_id: str) -> dict[str, Any] | None:
        self.initialize()
        item = self._latest_repair_queue_item(source_task_id)
        if not item or item.get("status") != "open":
            return None
        claimed = {
            **item,
            "timestamp": utc_now(),
            "status": "claimed",
            "claimed_by_task_id": worker_task_id,
        }
        self._append_jsonl(self.repair_queue_path, claimed)
        return claimed

    def finish_repair_item(
        self,
        *,
        source_task_id: str,
        worker_task_id: str,
        status: str,
        summary: str,
    ) -> dict[str, Any] | None:
        if status not in {"resolved", "failed"}:
            raise ValueError("repair item status must be resolved or failed")
        self.initialize()
        item = self._latest_repair_queue_item(source_task_id)
        if not item:
            return None
        finished = {
            **item,
            "timestamp": utc_now(),
            "status": status,
            "finished_by_task_id": worker_task_id,
            "finish_summary": summary,
        }
        self._append_jsonl(self.repair_queue_path, finished)
        return finished

    def requeue_repair_item(
        self,
        *,
        source_task_id: str,
        reason: str,
    ) -> dict[str, Any] | None:
        self.initialize()
        item = self._latest_repair_queue_item(source_task_id)
        if not item:
            return None
        requeued = {
            **item,
            "timestamp": utc_now(),
            "status": "open",
            "requeue_reason": reason,
        }
        self._append_jsonl(self.repair_queue_path, requeued)
        return requeued

    def append_regression_candidate(
        self,
        *,
        task_id: str,
        failure_type: str,
        stage: str,
        summary: str,
        reproduction: str,
        expected_behavior: str,
    ) -> None:
        self.initialize()
        self._append_jsonl(
            self.regression_candidate_path,
            {
                "timestamp": utc_now(),
                "task_id": task_id,
                "failure_type": failure_type,
                "stage": stage,
                "summary": summary,
                "reproduction": reproduction,
                "expected_behavior": expected_behavior,
                "test_status": "candidate",
            },
        )

    def list_regression_candidates(self, *, status: str | None = None, limit: int = 20) -> list[dict[str, Any]]:
        self.initialize()
        rows = self._read_jsonl_tail(self.regression_candidate_path, 10000)
        if status is not None:
            rows = [row for row in rows if row.get("test_status") == status]
        return rows[-limit:]

    def build_regression_manifest(self, *, limit: int = 20) -> dict[str, Any]:
        candidates = self.list_regression_candidates(status="candidate", limit=limit)
        return {
            "status": "available",
            "candidate_count": len(candidates),
            "recommended_tests": [
                {
                    "name": f"regression_{candidate.get('task_id', 'unknown').lower()}_{candidate.get('failure_type', 'unknown')}",
                    "task_id": candidate.get("task_id"),
                    "failure_type": candidate.get("failure_type"),
                    "stage": candidate.get("stage"),
                    "reproduction": candidate.get("reproduction"),
                    "expected_behavior": candidate.get("expected_behavior"),
                }
                for candidate in candidates
            ],
        }

    def append_experience(
        self,
        *,
        kind: str,
        task_id: str,
        pattern: str,
        summary: str,
        recommendation: str,
    ) -> None:
        self.initialize()
        path = self.success_log_path if kind == "success" else self.failure_log_path
        self._append_jsonl(
            path,
            {
                "timestamp": utc_now(),
                "task_id": task_id,
                "kind": kind,
                "pattern": pattern,
                "summary": summary,
                "recommendation": recommendation,
            },
        )

    def _append_jsonl(self, path: Path, row: dict[str, Any]) -> None:
        with path.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(row, ensure_ascii=True) + "\n")

    def _read_jsonl_tail(self, path: Path, limit: int) -> list[dict[str, Any]]:
        if not path.exists():
            return []
        lines = [line for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]
        rows = []
        for line in lines[-limit:]:
            rows.append(json.loads(line))
        return rows

    def _run_history_contains(self, task_id: str) -> bool:
        rows = self._read_jsonl_tail(self.run_history_path, 10000)
        return any(row.get("task_id") == task_id for row in rows)

    def _repair_queue_contains(self, task_id: str) -> bool:
        rows = self._read_jsonl_tail(self.repair_queue_path, 10000)
        return any(row.get("source_task_id") == task_id for row in rows)

    def _latest_repair_queue_item(self, source_task_id: str) -> dict[str, Any] | None:
        rows = self._read_jsonl_tail(self.repair_queue_path, 10000)
        latest = None
        for row in rows:
            if row.get("source_task_id") == source_task_id:
                latest = row
        return latest

    def _latest_approval_request(self, approval_id: str) -> dict[str, Any] | None:
        rows = self._read_jsonl_tail(self.approval_request_path, 10000)
        latest = None
        for row in rows:
            if row.get("approval_id") == approval_id:
                latest = row
        return latest


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


def _resume_strategy(failure_type: str) -> str:
    if failure_type == "code_error":
        return "split_scope_reroute_tools_and_restart_from_planning"
    if failure_type in {"network_error", "timeout"}:
        return "resume_after_backoff_with_previous_failure_history"
    if failure_type in {"permission_error", "auth_error"}:
        return "resume_after_permission_or_auth_is_restored"
    if failure_type == "configuration_error":
        return "resume_after_required_configuration_is_available"
    if failure_type == "requirement_ambiguity":
        return "resume_after_acceptance_scope_is_clarified"
    if failure_type == "production_risk":
        return "resume_only_after_explicit_production_approval"
    return "inspect_failure_history_then_restart_from_planning"
