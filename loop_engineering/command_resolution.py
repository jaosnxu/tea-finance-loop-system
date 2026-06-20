from __future__ import annotations

import os
import shlex
import shutil
import subprocess


def resolve_command_executable(command: list[str]) -> list[str]:
    if not command:
        return command
    executable = command[0]
    if "/" in executable:
        return command
    resolved = shutil.which(executable)
    if resolved:
        return [resolved, *command[1:]]
    shell_resolved = _resolve_with_login_shell(executable)
    if shell_resolved:
        return [shell_resolved, *command[1:]]
    return command


def environment_for_command(command: list[str], base_env: dict[str, str] | None = None) -> dict[str, str]:
    env = dict(base_env or os.environ)
    if not command:
        return env
    executable = command[0]
    if "/" not in executable:
        return env
    executable_dir = os.path.dirname(executable)
    if not executable_dir:
        return env
    path_parts = [part for part in env.get("PATH", "").split(os.pathsep) if part]
    if executable_dir not in path_parts:
        env["PATH"] = os.pathsep.join([executable_dir, *path_parts])
    return env


def _resolve_with_login_shell(executable: str) -> str | None:
    shell = os.environ.get("SHELL") or "/bin/zsh"
    if not os.path.exists(shell):
        shell = "/bin/bash"
    try:
        completed = subprocess.run(
            [shell, "-lc", f"command -v {shlex.quote(executable)}"],
            capture_output=True,
            text=True,
            timeout=10,
            check=False,
        )
    except (OSError, subprocess.TimeoutExpired):
        return None
    if completed.returncode != 0:
        return None
    resolved = completed.stdout.strip().splitlines()[0] if completed.stdout.strip() else ""
    return resolved or None
