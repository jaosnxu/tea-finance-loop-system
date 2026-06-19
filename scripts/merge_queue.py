from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from loop_engineering.merge_queue import (
    DEFAULT_REQUIRED_CHECKS,
    MergeQueueConfig,
    MergeQueueRunner,
    read_repo_from_git_remote,
    read_token_from_environment,
    read_token_from_git_credential,
)


def _csv(value: str) -> list[str]:
    return [item.strip() for item in value.split(",") if item.strip()]


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Run a Loop GitHub PR merge queue.")
    parser.add_argument("--queue", required=True, help="Comma-separated PR queue, for example 28,29,31")
    parser.add_argument("--repo", default=None, help="GitHub repository in owner/name form. Defaults to git origin.")
    parser.add_argument("--target-base", default="main", help="Target base branch. Defaults to main.")
    parser.add_argument("--merge-method", default="merge", choices=["merge", "squash", "rebase"], help="GitHub merge method.")
    parser.add_argument("--required-checks", default=",".join(DEFAULT_REQUIRED_CHECKS), help="Comma-separated required check names.")
    parser.add_argument("--apply", action="store_true", help="Patch bases and merge. Without this flag, only plan.")
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    token = read_token_from_environment() or read_token_from_git_credential()
    if not token:
        print(json.dumps({"ok": False, "error": "missing_github_token"}, indent=2), file=sys.stderr)
        return 1

    config = MergeQueueConfig(
        repo=args.repo or read_repo_from_git_remote(),
        token=token,
        target_base=args.target_base,
        merge_method=args.merge_method,
        required_checks=tuple(_csv(args.required_checks)),
        apply=args.apply,
    )
    queue = [int(item) for item in _csv(args.queue)]
    result = MergeQueueRunner(config).run(queue)
    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
