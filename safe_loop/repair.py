from __future__ import annotations

def classify_failure(returncode: int, stdout: str, stderr: str) -> str:
    output = f"{stdout}\n{stderr}".lower()
    if returncode == 0:
        return "success"
    if "command not found" in output or "no such file or directory" in output:
        return "environment"
    if "permission denied" in output:
        return "permissions"
    if "assert" in output or "failed" in output or "error:" in output:
        return "task_failure"
    if "timeout" in output:
        return "timeout"
    return "unknown"


def choose_recovery_action(category: str, attempt: int, max_attempts: int) -> str:
    if category == "success":
        return "none"
    if attempt >= max_attempts:
        return "stop"
    if category in {"environment", "permissions"}:
        return "reset_and_stop"
    if category in {"task_failure", "unknown", "timeout"}:
        return "reset_and_retry"
    return "stop"
