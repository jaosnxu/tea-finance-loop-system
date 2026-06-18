from __future__ import annotations

import json
import subprocess
from typing import Any


def inspect_github_workflow(payload: dict[str, Any], timeout_seconds: int = 30) -> dict[str, Any]:
    repo = payload.get("repo", "unknown")
    pr_number = payload.get("github_pr_number")
    head_ref = payload.get("github_head_ref") or payload.get("branch")
    base_ref = payload.get("github_base_ref") or "main"
    gh_command = payload.get("github_command")
    artifacts = [
        {
            "type": "github_pr_plan",
            "value": {
                "repo": repo,
                "head_ref": head_ref,
                "base_ref": base_ref,
                "pr_number": pr_number,
                "required_gates": ["review_gate", "ci_test_runner", "merge_gate"],
            },
        }
    ]

    if not gh_command:
        artifacts.append({"type": "github_remote_status", "value": {"available": False, "reason": "github_command not configured"}})
        return {
            "status": "completed",
            "summary": "Prepared GitHub PR workflow plan without remote inspection.",
            "artifacts": artifacts,
            "failure_type": None,
        }

    try:
        completed = subprocess.run(
            [str(item) for item in gh_command],
            capture_output=True,
            text=True,
            timeout=timeout_seconds,
            check=False,
        )
    except FileNotFoundError as exc:
        artifacts.append({"type": "stderr", "value": str(exc)})
        return {
            "status": "failed",
            "summary": "GitHub workflow failed before execution.",
            "artifacts": artifacts,
            "failure_type": "configuration_error",
        }
    except subprocess.TimeoutExpired as exc:
        artifacts.append({"type": "stderr", "value": (exc.stderr or exc.stdout or str(exc)).strip()})
        return {
            "status": "failed",
            "summary": "GitHub workflow timed out.",
            "artifacts": artifacts,
            "failure_type": "timeout",
        }

    stdout = (completed.stdout or "").strip()
    stderr = (completed.stderr or "").strip()
    artifacts.extend(
        [
            {"type": "github_command", "value": gh_command},
            {"type": "github_exit_code", "value": completed.returncode},
            {"type": "github_stdout", "value": stdout},
            {"type": "github_stderr", "value": stderr},
            {"type": "github_remote_status", "value": _parse_remote_status(stdout, completed.returncode)},
        ]
    )
    if completed.returncode != 0:
        return {
            "status": "failed",
            "summary": f"GitHub workflow command failed with exit code {completed.returncode}.",
            "artifacts": artifacts,
            "failure_type": _classify_github_failure(stderr or stdout),
        }
    return {
        "status": "completed",
        "summary": "Inspected GitHub PR workflow state.",
        "artifacts": artifacts,
        "failure_type": None,
    }


def _parse_remote_status(stdout: str, exit_code: int) -> dict[str, Any]:
    if not stdout:
        return {"available": exit_code == 0, "raw": stdout}
    try:
        value = json.loads(stdout)
    except json.JSONDecodeError:
        return {"available": exit_code == 0, "raw": stdout}
    return {"available": exit_code == 0, "json": value}


def _classify_github_failure(output: str) -> str:
    text = output.lower()
    if "authentication" in text or "unauthorized" in text or "forbidden" in text:
        return "auth_error"
    if "not found" in text or "unknown" in text:
        return "configuration_error"
    return "unknown"
