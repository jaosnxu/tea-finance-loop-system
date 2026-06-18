from __future__ import annotations

import subprocess
from pathlib import Path
from typing import Any


def inspect_git_workflow(repo_path: str, base_ref: str | None = None, timeout_seconds: int = 30) -> dict[str, Any]:
    path = Path(repo_path)
    if not path.exists():
        return _failed("configuration_error", f"Repository path does not exist: {repo_path}", path)

    inside = _run_git(path, ["rev-parse", "--is-inside-work-tree"], timeout_seconds)
    if inside["exit_code"] != 0 or inside["stdout"] != "true":
        return {
            "status": "completed",
            "summary": "VCS workflow skipped because target is not a git repository.",
            "artifacts": [
                {"type": "vcs_repository_path", "value": str(path)},
                {"type": "vcs_repository_present", "value": False},
                {"type": "stderr", "value": inside["stderr"] or "not a git repository"},
            ],
            "failure_type": None,
        }

    root = _run_git(path, ["rev-parse", "--show-toplevel"], timeout_seconds)["stdout"] or str(path)
    branch = _run_git(path, ["branch", "--show-current"], timeout_seconds)
    head = _run_git(path, ["rev-parse", "--short", "HEAD"], timeout_seconds)
    status = _run_git(path, ["status", "--porcelain=v1"], timeout_seconds)
    changed_files = _parse_status_files(status["stdout"])
    diff_names = _run_git(path, ["diff", "--name-only"], timeout_seconds)
    staged_names = _run_git(path, ["diff", "--cached", "--name-only"], timeout_seconds)
    diff_stat = _run_git(path, ["diff", "--stat"], timeout_seconds)

    base_diff_files: list[str] = []
    if base_ref:
        base_diff = _run_git(path, ["diff", "--name-only", f"{base_ref}...HEAD"], timeout_seconds)
        if base_diff["exit_code"] == 0:
            base_diff_files = _split_lines(base_diff["stdout"])

    artifacts = [
        {"type": "vcs_repository_present", "value": True},
        {"type": "vcs_repository_root", "value": root},
        {"type": "vcs_branch", "value": branch["stdout"]},
        {"type": "vcs_head", "value": head["stdout"]},
        {"type": "vcs_status", "value": status["stdout"]},
        {"type": "vcs_changed_files", "value": changed_files},
        {"type": "vcs_unstaged_files", "value": _split_lines(diff_names["stdout"])},
        {"type": "vcs_staged_files", "value": _split_lines(staged_names["stdout"])},
        {"type": "vcs_diff_stat", "value": diff_stat["stdout"]},
        {
            "type": "vcs_commit_plan",
            "value": {
                "can_commit": bool(changed_files),
                "recommended_branch_prefix": "loop/",
                "changed_files": changed_files,
                "message_template": _message_template(changed_files),
                "base_ref": base_ref,
                "base_diff_files": base_diff_files,
            },
        },
    ]

    return {
        "status": "completed",
        "summary": "Inspected VCS workflow state.",
        "artifacts": artifacts,
        "failure_type": None,
    }


def _run_git(cwd: Path, args: list[str], timeout_seconds: int) -> dict[str, Any]:
    completed = subprocess.run(
        ["git", *args],
        cwd=str(cwd),
        capture_output=True,
        text=True,
        timeout=timeout_seconds,
        check=False,
    )
    return {
        "command": ["git", *args],
        "exit_code": completed.returncode,
        "stdout": (completed.stdout or "").strip(),
        "stderr": (completed.stderr or "").strip(),
    }


def _parse_status_files(status_output: str) -> list[str]:
    files: list[str] = []
    for line in _split_lines(status_output):
        if len(line) < 4:
            continue
        name = line[3:]
        if " -> " in name:
            name = name.split(" -> ", 1)[1]
        files.append(name)
    return files


def _split_lines(value: str) -> list[str]:
    return [line for line in value.splitlines() if line]


def _message_template(changed_files: list[str]) -> str:
    if not changed_files:
        return "chore: no source changes"
    if len(changed_files) == 1:
        return f"chore: update {changed_files[0]}"
    return f"chore: update {len(changed_files)} files"


def _failed(failure_type: str, reason: str, path: Path) -> dict[str, Any]:
    return {
        "status": "failed",
        "summary": f"VCS workflow failed: {reason}",
        "artifacts": [
            {"type": "vcs_repository_path", "value": str(path)},
            {"type": "stderr", "value": reason},
        ],
        "failure_type": failure_type,
    }
