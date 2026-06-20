from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys

from .boot import boot_runtime
from .models import BootPayload
from .repair_scheduler import plan_repair_queue, requeue_stale_claims
from .repository_memory import RepositoryMemory
from .trace_summary import summarize_trace
from .watchdog import evaluate_heartbeat


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Run the minimal Loop Engineering runtime.")
    parser.add_argument("--boot", required=True, help="Path to boot payload JSON")
    parser.add_argument("--skills", required=True, help="Path to skill registry JSON")
    parser.add_argument("--connectors", required=True, help="Path to connector registry JSON")
    parser.add_argument("--steps", type=int, default=6, help="Maximum runtime steps")
    parser.add_argument("--resume", action="store_true", help="Resume existing durable task state when present")
    parser.add_argument("--report", action="store_true", help="Print the durable run report after execution")
    parser.add_argument("--watchdog", action="store_true", help="Evaluate the current task heartbeat without running workflow steps")
    parser.add_argument("--heartbeat-timeout", type=int, default=300, help="Watchdog heartbeat timeout in seconds")
    parser.add_argument("--memory-report", action="store_true", help="Print repository memory status and recent actions without running workflow steps")
    parser.add_argument("--memory-actions", type=int, default=10, help="Number of recent repository memory actions to print")
    parser.add_argument("--issues-report", action="store_true", help="Print recent Loop system issues from repository memory")
    parser.add_argument("--record-issue", action="store_true", help="Append a Loop system issue to repository memory")
    parser.add_argument("--issue-id", help="Issue id, for example LOOP-ISSUE-0001")
    parser.add_argument("--issue-project", default="loop-engineering", help="Project name for issue register")
    parser.add_argument("--issue-severity", default="medium", choices=["low", "medium", "high", "critical"])
    parser.add_argument("--issue-status", default="open", choices=["open", "investigating", "blocked", "fixed", "verified", "closed"])
    parser.add_argument("--issue-situation", default="")
    parser.add_argument("--issue-symptom", default="")
    parser.add_argument("--issue-cause", default="")
    parser.add_argument("--issue-impact", default="")
    parser.add_argument("--issue-action", default="")
    parser.add_argument("--issue-next-step", default="")
    parser.add_argument("--issue-related-task-id")
    parser.add_argument("--issue-related-pr")
    parser.add_argument("--issue-related-check")
    parser.add_argument("--issue-regression-test")
    parser.add_argument("--repair-queue-report", action="store_true", help="Print repair queue scheduler plan without running workflow steps")
    parser.add_argument("--approval-report", action="store_true", help="Print open approval requests without running workflow steps")
    parser.add_argument("--approve-id", help="Approve an approval request id")
    parser.add_argument("--reject-id", help="Reject an approval request id")
    parser.add_argument("--resolved-by", default="loop-operator", help="Actor used when resolving an approval request")
    parser.add_argument("--resolution-note", default="resolved from CLI", help="Resolution note for approval changes")
    parser.add_argument("--requeue-stale", action="store_true", help="Requeue stale claimed repair items")
    parser.add_argument("--regression-manifest", action="store_true", help="Print regression test manifest from candidates")
    parser.add_argument("--trace-summary", action="store_true", help="Print current task trace summary without running workflow steps")
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    payload = BootPayload.from_dict(json.loads(Path(args.boot).read_text(encoding="utf-8")))
    if (
        args.memory_report
        or args.issues_report
        or args.record_issue
        or args.repair_queue_report
        or args.approval_report
        or args.approve_id
        or args.reject_id
        or args.requeue_stale
        or args.regression_manifest
    ):
        memory = _load_repository_memory_from_payload(payload)
        if not memory:
            print(json.dumps({"status": "unavailable", "reason": "repository_memory_path missing"}, indent=2, ensure_ascii=True))
            return 1
        if args.record_issue:
            if not args.issue_id:
                print(json.dumps({"status": "failed", "reason": "issue-id is required"}, indent=2, ensure_ascii=True))
                return 1
            memory.append_issue(
                issue_id=args.issue_id,
                project=args.issue_project,
                severity=args.issue_severity,
                status=args.issue_status,
                situation=args.issue_situation,
                symptom=args.issue_symptom,
                cause=args.issue_cause,
                impact=args.issue_impact,
                action_taken=args.issue_action,
                next_step=args.issue_next_step,
                related_task_id=args.issue_related_task_id,
                related_pr=args.issue_related_pr,
                related_check=args.issue_related_check,
                regression_test=args.issue_regression_test,
            )
            print(json.dumps({"status": "recorded", "issue_id": args.issue_id}, indent=2, ensure_ascii=True))
            return 0
        if args.issues_report:
            print(
                json.dumps(
                    {
                        "status": "available",
                        "issues": memory.search_issues(limit=args.memory_actions),
                    },
                    indent=2,
                    ensure_ascii=True,
                )
            )
            return 0
        if args.repair_queue_report:
            print(json.dumps(plan_repair_queue(memory), indent=2, ensure_ascii=True))
            return 0
        if args.requeue_stale:
            print(json.dumps(requeue_stale_claims(memory), indent=2, ensure_ascii=True))
            return 0
        if args.approve_id or args.reject_id:
            approval_id = args.approve_id or args.reject_id
            status = "approved" if args.approve_id else "rejected"
            result = memory.resolve_approval_request(
                approval_id=approval_id,
                status=status,
                resolved_by=args.resolved_by,
                resolution_note=args.resolution_note,
            )
            if not result:
                print(json.dumps({"status": "not_found", "approval_id": approval_id}, indent=2, ensure_ascii=True))
                return 1
            print(json.dumps({"status": "updated", "approval_request": result}, indent=2, ensure_ascii=True))
            return 0
        if args.approval_report:
            print(
                json.dumps(
                    {
                        "status": "available",
                        "root": str(memory.root),
                        "open_approval_requests": memory.list_approval_requests(status="open", limit=args.memory_actions),
                    },
                    indent=2,
                    ensure_ascii=True,
                )
            )
            return 0
        if args.regression_manifest:
            print(json.dumps(memory.build_regression_manifest(limit=args.memory_actions), indent=2, ensure_ascii=True))
            return 0
        snapshot = memory.read_required_context(recent_actions=args.memory_actions)
        print(
            json.dumps(
                {
                    "status": "available",
                    "root": snapshot["root"],
                    "current_status": snapshot["current_status"],
                    "recent_actions": snapshot["recent_actions"],
                    "recent_issues": snapshot["recent_issues"],
                    "recent_intent_debt": snapshot["recent_intent_debt"],
                    "recent_repair_queue": snapshot["recent_repair_queue"],
                    "open_repair_queue": snapshot["open_repair_queue"],
                    "claimable_repair_queue": snapshot["claimable_repair_queue"],
                    "open_approval_requests": snapshot["open_approval_requests"],
                    "recent_regression_candidates": snapshot["recent_regression_candidates"],
                    "recent_successes": snapshot["recent_successes"],
                    "recent_failures": snapshot["recent_failures"],
                    "loaded_files": sorted(snapshot["files"].keys()),
                },
                indent=2,
                ensure_ascii=True,
            )
        )
        return 0
    runtime, task_store, memory_store = boot_runtime(payload, args.skills, args.connectors, resume_existing=args.resume)
    if args.watchdog:
        print(json.dumps(evaluate_heartbeat(runtime.context.task_record, args.heartbeat_timeout), indent=2, ensure_ascii=True))
        return 0
    if args.trace_summary:
        print(json.dumps(summarize_trace(task_store.read_trace()), indent=2, ensure_ascii=True))
        return 0
    results = runtime.run_until_terminal(max_steps=args.steps)
    task_store.save(runtime.context.task_record)
    memory_store.save(runtime.context.memory)
    if args.report:
        print(json.dumps(task_store.write_run_report(runtime.context.task_record), indent=2, ensure_ascii=True))
    else:
        print(json.dumps([result.__dict__ for result in results], indent=2, ensure_ascii=True))
    return 0


def _load_repository_memory_from_payload(payload: BootPayload) -> RepositoryMemory | None:
    memory_path = payload.environment.get("repository_memory_path")
    if not memory_path:
        return None
    if not str(memory_path).startswith("/"):
        repository_root = payload.environment.get("repository_root") or payload.environment.get("source_path") or "."
        memory_path = f"{repository_root}/{memory_path}"
    return RepositoryMemory(memory_path)


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
