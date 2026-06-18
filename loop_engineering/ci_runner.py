from __future__ import annotations

import subprocess
from pathlib import Path
from typing import Any


def run_ci_suite(
    suites: list[dict[str, Any]],
    default_command: list[str] | None,
    cwd: str,
    timeout_seconds: int = 60,
) -> dict[str, Any]:
    normalized = _normalize_suites(suites, default_command)
    if not normalized:
        return {
            "status": "failed",
            "summary": "CI suite failed before execution.",
            "artifacts": [{"type": "stderr", "value": "No CI test suites or test command configured."}],
            "failure_type": "configuration_error",
        }

    results = []
    for suite in normalized:
        command = [str(item) for item in suite["command"]]
        suite_cwd = str(suite.get("cwd") or cwd)
        suite_timeout = int(suite.get("timeout_seconds") or timeout_seconds)
        try:
            completed = subprocess.run(
                command,
                cwd=suite_cwd,
                capture_output=True,
                text=True,
                timeout=suite_timeout,
                check=False,
            )
            result = {
                "name": suite["name"],
                "command": command,
                "cwd": suite_cwd,
                "exit_code": completed.returncode,
                "stdout": (completed.stdout or "").strip(),
                "stderr": (completed.stderr or "").strip(),
                "status": "passed" if completed.returncode == 0 else "failed",
            }
        except FileNotFoundError as exc:
            result = _suite_failed(suite, command, suite_cwd, "configuration_error", str(exc))
        except subprocess.TimeoutExpired as exc:
            result = _suite_failed(
                suite,
                command,
                suite_cwd,
                "timeout",
                (exc.stderr or exc.stdout or str(exc)).strip(),
            )
        results.append(result)
        if result["status"] != "passed":
            break

    passed = [item for item in results if item["status"] == "passed"]
    failed = [item for item in results if item["status"] != "passed"]
    artifacts = [
        {
            "type": "ci_suite_summary",
            "value": {
                "total": len(results),
                "passed": len(passed),
                "failed": len(failed),
                "stopped_on_first_failure": bool(failed),
            },
        },
        {"type": "ci_suite_results", "value": results},
    ]
    if failed:
        failure = failed[0]
        return {
            "status": "failed",
            "summary": f"CI suite failed: {failure['name']}.",
            "artifacts": artifacts,
            "failure_type": failure.get("failure_type") or "code_error",
        }
    return {
        "status": "completed",
        "summary": "CI suite passed.",
        "artifacts": artifacts,
        "failure_type": None,
    }


def _normalize_suites(suites: list[dict[str, Any]], default_command: list[str] | None) -> list[dict[str, Any]]:
    if suites:
        return [
            {
                "name": str(item.get("name") or f"suite-{index + 1}"),
                "command": item["command"],
                "cwd": item.get("cwd"),
                "timeout_seconds": item.get("timeout_seconds"),
            }
            for index, item in enumerate(suites)
            if item.get("command")
        ]
    if default_command:
        return [{"name": "default", "command": default_command}]
    return []


def _suite_failed(
    suite: dict[str, Any],
    command: list[str],
    cwd: str,
    failure_type: str,
    details: str,
) -> dict[str, Any]:
    return {
        "name": suite["name"],
        "command": command,
        "cwd": str(Path(cwd)),
        "exit_code": None,
        "stdout": "",
        "stderr": details,
        "status": "failed",
        "failure_type": failure_type,
    }
