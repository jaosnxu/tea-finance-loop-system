from __future__ import annotations

import argparse
import sys

from .engine import SafeLoopEngine
from .models import RunConfig


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Run a safe loop task in an isolated sandbox.")
    subparsers = parser.add_subparsers(dest="command_name", required=True)

    run_parser = subparsers.add_parser("run", help="Run a task")
    run_parser.add_argument("--project", required=True, help="Path to the target project")
    run_parser.add_argument("--task", required=True, help="Human-readable task description")
    run_parser.add_argument("--cmd", required=True, help="Shell command to run in the sandbox")
    run_parser.add_argument("--max-attempts", type=int, default=3, help="Maximum repair attempts")
    run_parser.add_argument(
        "--sandbox-root",
        default="/private/tmp/safe-loop-runs",
        help="Root directory for temporary sandboxes",
    )
    run_parser.add_argument(
        "--state-root",
        default="/private/tmp/safe-loop-state",
        help="Root directory for logs and summaries",
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)

    config = RunConfig(
        project_path=args.project,
        task=args.task,
        command=args.cmd,
        max_attempts=args.max_attempts,
        sandbox_root=args.sandbox_root,
        state_root=args.state_root,
    )
    engine = SafeLoopEngine(config)
    summary = engine.run()
    print(SafeLoopEngine.format_summary(summary))
    return 0 if summary["status"] == "completed" else 1


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
