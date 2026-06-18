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
- Keep project status, standards, decisions, integrations, and open questions current.
- Store reusable experience in `experience/successes.jsonl` and `experience/failures.jsonl`.
""",
    "project_context.md": """# Project Context

Loop Engineering is the reusable execution system in this repository.
`tea-finance-system` is the first business project managed by Loop; it is not the Loop system itself.

Primary project:
- Tea finance management system for a Russian tea-chain business.
- V1 focus: payment request -> approval -> finance execution -> ledger -> reports.
- Product principle: configuration-driven backend and componentized frontend.
""",
    "project_status.md": """# Project Status

Current source of truth:
- GitHub repository: jaosnxu/tea-finance-loop-system
- Figma file key: DVWsGG329BggsIlWbUXBYS
- Loop tests should pass before release.

Update this file whenever a project milestone changes.
""",
    "project_standards.md": """# Project Standards

Loop standards:
- Fixed workflow before autonomy.
- Each step has status, heartbeat, timeout, retry policy, review, and verification.
- Network failures can retry automatically.
- Auth, permission, production config, or unclear requirement failures become blocked intent debt.
- Writer, reviewer, and verifier gates must remain separate in records.
- Every action must be written outside conversation memory.

Tea finance standards:
- Backend business behavior should be configuration-driven.
- Organization, tax mode, currency behavior, roles, menus, and approval rules must not be hardcoded.
- UI is Russian-first in sizing and structure, with Chinese UI available for testing.
- Default currency is RUB unless organization config enables multi-currency.
""",
    "decisions.md": """# Decisions

- The repository is the long-term memory source for Loop.
- Runtime task records remain external, but project-level memory is committed in the repository.
- `tea-finance-system` is one managed project under Loop.
""",
    "open_questions.md": """# Open Questions

- Production iiko integration credentials and API scope are not configured yet.
- GitHub Actions workflow is not yet the only CI gate.
- Final Russia tax/accounting validation still needs a qualified local review before production use.
""",
    "integration_state.md": """# Integration State

GitHub:
- Repository: jaosnxu/tea-finance-loop-system
- Default branch: main

Figma:
- File key: DVWsGG329BggsIlWbUXBYS

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
    "projects/tea-finance-system.md": """# Tea Finance System Project Record

Purpose:
- Russian tea-chain internal finance, approval, ledger, reporting, organization, role, and configuration system.

V1 boundary:
- Payment request -> approval -> finance execution -> ledger -> reports.
- Boss, finance, cashier, and applicant roles.
- Organization, store, tax mode, bank account, supplier, role, menu, and approval config are backend-managed.

Deferred:
- Public seal workflow.
- Mobile app.
- Full automatic intercompany offset.
""",
    "backlog/loop-engineering.json": """{
  "project": "loop-engineering",
  "updated_at": "2026-06-18",
  "items": []
}
""",
    "backlog/tea-finance-system.json": """{
  "project": "tea-finance-system",
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
    "issues/README.md": """# Loop System Issue Register

Every Loop-system issue must be recorded here, including time, situation, symptom, cause, impact, status, resolution, and regression coverage.
""",
}


class RepositoryMemory:
    def __init__(self, root: str | Path) -> None:
        self.root = Path(root)
        self.action_log_path = self.root / "action_log.jsonl"
        self.intent_debt_path = self.root / "intent_debt.jsonl"
        self.issue_register_path = self.root / "issues" / "loop-system-issues.jsonl"
        self.regression_candidate_path = self.root / "regression_candidates.jsonl"
        self.current_status_path = self.root / "current_status.json"
        self.success_log_path = self.root / "experience" / "successes.jsonl"
        self.failure_log_path = self.root / "experience" / "failures.jsonl"

    def initialize(self) -> None:
        self.root.mkdir(parents=True, exist_ok=True)
        (self.root / "projects").mkdir(parents=True, exist_ok=True)
        (self.root / "backlog").mkdir(parents=True, exist_ok=True)
        (self.root / "issues").mkdir(parents=True, exist_ok=True)
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
            self.issue_register_path,
            self.regression_candidate_path,
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
            "recent_issues": self._read_jsonl_tail(self.issue_register_path, recent_actions),
            "recent_intent_debt": self._read_jsonl_tail(self.intent_debt_path, recent_actions),
            "recent_regression_candidates": self._read_jsonl_tail(self.regression_candidate_path, recent_actions),
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

    def search_issues(
        self,
        *,
        status: str | None = None,
        severity: str | None = None,
        project: str | None = None,
        limit: int = 20,
    ) -> list[dict[str, Any]]:
        self.initialize()
        rows = self._read_jsonl_tail(self.issue_register_path, 10000)
        if status:
            rows = [row for row in rows if row.get("status") == status]
        if severity:
            rows = [row for row in rows if row.get("severity") == severity]
        if project:
            rows = [row for row in rows if row.get("project") == project]
        return rows[-limit:]

    def append_issue(
        self,
        *,
        issue_id: str,
        project: str,
        severity: str,
        status: str,
        situation: str,
        symptom: str,
        cause: str,
        impact: str,
        action_taken: str,
        next_step: str,
        related_task_id: str | None = None,
        related_pr: str | None = None,
        related_check: str | None = None,
        regression_test: str | None = None,
    ) -> None:
        self.initialize()
        self._append_jsonl(
            self.issue_register_path,
            {
                "timestamp": utc_now(),
                "issue_id": issue_id,
                "project": project,
                "severity": severity,
                "status": status,
                "situation": situation,
                "symptom": symptom,
                "cause": cause,
                "impact": impact,
                "action_taken": action_taken,
                "next_step": next_step,
                "related_task_id": related_task_id,
                "related_pr": related_pr,
                "related_check": related_check,
                "regression_test": regression_test,
            },
        )

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
