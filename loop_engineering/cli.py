from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys

from .boot import boot_runtime
from .models import BootPayload
from .repository_memory import RepositoryMemory
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
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    payload = BootPayload.from_dict(json.loads(Path(args.boot).read_text(encoding="utf-8")))
    if args.memory_report:
        memory_path = payload.environment.get("repository_memory_path")
        if not memory_path:
            print(json.dumps({"status": "unavailable", "reason": "repository_memory_path missing"}, indent=2, ensure_ascii=True))
            return 1
        if not str(memory_path).startswith("/"):
            repository_root = payload.environment.get("repository_root") or payload.environment.get("source_path") or "."
            memory_path = f"{repository_root}/{memory_path}"
        memory = RepositoryMemory(memory_path)
        snapshot = memory.read_required_context(recent_actions=args.memory_actions)
        print(
            json.dumps(
                {
                    "status": "available",
                    "root": snapshot["root"],
                    "current_status": snapshot["current_status"],
                    "recent_actions": snapshot["recent_actions"],
                    "recent_intent_debt": snapshot["recent_intent_debt"],
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
    results = runtime.run_until_terminal(max_steps=args.steps)
    task_store.save(runtime.context.task_record)
    memory_store.save(runtime.context.memory)
    if args.report:
        print(json.dumps(task_store.write_run_report(runtime.context.task_record), indent=2, ensure_ascii=True))
    else:
        print(json.dumps([result.__dict__ for result in results], indent=2, ensure_ascii=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
