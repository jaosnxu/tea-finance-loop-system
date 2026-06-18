from __future__ import annotations

import json
import subprocess
from pathlib import Path
from typing import Any

from .ci_runner import run_ci_suite
from .git_workflow import inspect_git_workflow
from .github_workflow import inspect_github_workflow
from .mcp_protocol import MCPProtocolError, MCPStdioClient
from .models import ConnectorMeta


class ConnectorExecutionError(RuntimeError):
    pass


def execute_connector(connector: ConnectorMeta, payload: dict[str, Any]) -> dict[str, Any]:
    spec = _load_connector_spec(connector.entry)
    executor = spec.get("executor", {"type": "template"})
    executor_type = executor.get("type", "template")

    if executor_type == "template":
        return _render_template_output(connector, spec, payload)
    if executor_type == "shell":
        return _execute_shell_connector(connector, spec, payload)
    if executor_type == "mcp_stdio":
        return _execute_mcp_stdio_connector(connector, spec, payload)
    if executor_type == "vcs_workflow":
        return _execute_vcs_workflow_connector(connector, spec, payload)
    if executor_type == "ci_suite":
        return _execute_ci_suite_connector(connector, spec, payload)
    if executor_type == "github_workflow":
        return _execute_github_workflow_connector(connector, spec, payload)
    if executor_type == "integration_manifest":
        return _execute_integration_manifest_connector(connector, spec, payload)
    raise ConnectorExecutionError(f"Unsupported connector executor: {executor_type}")


def _load_connector_spec(entry: str) -> dict[str, Any]:
    path = Path(entry)
    if not path.exists():
        raise ConnectorExecutionError(f"Connector entry not found: {entry}")
    return json.loads(path.read_text(encoding="utf-8"))


def _render_template_output(connector: ConnectorMeta, spec: dict[str, Any], payload: dict[str, Any]) -> dict[str, Any]:
    template = spec.get("template", {})
    artifacts = []
    for artifact_spec in template.get("artifacts", []):
        value = _resolve_template_value(connector, artifact_spec.get("resolver"), payload)
        artifacts.append({"type": artifact_spec["type"], "value": value})
    return {
        "connector": connector.name,
        "status": "completed",
        "summary": template.get("summary", f"Executed connector {connector.name}."),
        "artifacts": artifacts,
        "next_recommendation": template.get("next_recommendation", ""),
    }


def _execute_shell_connector(connector: ConnectorMeta, spec: dict[str, Any], payload: dict[str, Any]) -> dict[str, Any]:
    executor = spec["executor"]
    command = _resolve_shell_command(executor, payload)
    cwd = _resolve_cwd(executor, payload)
    timeout_seconds = int(payload.get("connector_timeout_seconds") or executor.get("timeout_seconds", 30))

    if not command:
        raise ConnectorExecutionError(f"No command resolved for connector {connector.name}")

    try:
        completed = subprocess.run(
            command,
            cwd=str(cwd) if cwd else None,
            capture_output=True,
            text=True,
            timeout=timeout_seconds,
            check=False,
        )
    except FileNotFoundError as exc:
        return _failed_shell_result(connector, command, cwd, "configuration_error", str(exc))
    except subprocess.TimeoutExpired as exc:
        return _failed_shell_result(
            connector,
            command,
            cwd,
            "timeout",
            (exc.stderr or exc.stdout or str(exc)).strip(),
        )

    stdout = (completed.stdout or "").strip()
    stderr = (completed.stderr or "").strip()
    artifacts = [
        {"type": "command", "value": command},
        {"type": "working_directory", "value": str(cwd) if cwd else None},
        {"type": "exit_code", "value": completed.returncode},
        {"type": "stdout", "value": stdout},
        {"type": "stderr", "value": stderr},
    ]

    if completed.returncode != 0:
        failure_type = _classify_command_failure(stderr or stdout, connector.name)
        return {
            "connector": connector.name,
            "status": "failed",
            "summary": f"Connector {connector.name} failed with exit code {completed.returncode}.",
            "artifacts": artifacts,
            "failure_type": failure_type,
            "next_recommendation": "Review stderr, unblock dependency, or retry with corrected connector input.",
        }

    return {
        "connector": connector.name,
        "status": "completed",
        "summary": spec.get("template", {}).get("summary", f"Executed connector {connector.name}."),
        "artifacts": artifacts,
        "next_recommendation": spec.get("template", {}).get(
            "next_recommendation",
            "Use command result to refine next execution step.",
        ),
    }


def _execute_vcs_workflow_connector(connector: ConnectorMeta, spec: dict[str, Any], payload: dict[str, Any]) -> dict[str, Any]:
    executor = spec["executor"]
    repo_path = payload.get(executor.get("repo_path_from_payload_key", "git_path")) or payload.get("path") or "."
    timeout_seconds = int(payload.get("connector_timeout_seconds") or executor.get("timeout_seconds", 30))
    result = inspect_git_workflow(
        str(repo_path),
        base_ref=payload.get(executor.get("base_ref_from_payload_key", "git_base_ref")),
        timeout_seconds=timeout_seconds,
    )
    return {
        "connector": connector.name,
        "status": result["status"],
        "summary": result["summary"],
        "artifacts": result["artifacts"],
        "failure_type": result.get("failure_type"),
        "next_recommendation": spec.get("template", {}).get(
            "next_recommendation",
            "Use VCS workflow state to drive branch, diff, commit, and PR gates.",
        ),
    }


def _execute_ci_suite_connector(connector: ConnectorMeta, spec: dict[str, Any], payload: dict[str, Any]) -> dict[str, Any]:
    executor = spec["executor"]
    cwd = _resolve_cwd(executor, payload) or Path(".")
    timeout_seconds = int(payload.get("connector_timeout_seconds") or executor.get("timeout_seconds", 60))
    result = run_ci_suite(
        suites=payload.get("test_suites") or ([] if payload.get(executor.get("command_from_payload_key", "")) else executor.get("default_suites", [])),
        default_command=_resolve_payload_command(executor.get("command_from_payload_key"), payload),
        cwd=str(cwd),
        timeout_seconds=timeout_seconds,
    )
    return {
        "connector": connector.name,
        "status": result["status"],
        "summary": spec.get("template", {}).get("summary", result["summary"]) if result["status"] == "completed" else result["summary"],
        "artifacts": result["artifacts"],
        "failure_type": result.get("failure_type"),
        "next_recommendation": spec.get("template", {}).get(
            "next_recommendation",
            "Use CI suite results as the verification signal for the current iteration.",
        ),
    }


def _execute_github_workflow_connector(connector: ConnectorMeta, spec: dict[str, Any], payload: dict[str, Any]) -> dict[str, Any]:
    executor = spec["executor"]
    timeout_seconds = int(payload.get("connector_timeout_seconds") or executor.get("timeout_seconds", 30))
    result = inspect_github_workflow(payload, timeout_seconds=timeout_seconds)
    return {
        "connector": connector.name,
        "status": result["status"],
        "summary": result["summary"],
        "artifacts": result["artifacts"],
        "failure_type": result.get("failure_type"),
        "next_recommendation": spec.get("template", {}).get(
            "next_recommendation",
            "Use GitHub PR and checks state as a remote merge gate signal.",
        ),
    }


def _execute_integration_manifest_connector(connector: ConnectorMeta, spec: dict[str, Any], payload: dict[str, Any]) -> dict[str, Any]:
    executor = spec["executor"]
    required_payload_keys = executor.get("required_payload_keys", [])
    missing = [key for key in required_payload_keys if not payload.get(key)]
    artifacts = [
        {"type": f"{connector.name}_integration_manifest", "value": spec.get("integration", {})},
        {"type": f"{connector.name}_required_inputs", "value": required_payload_keys},
        {"type": f"{connector.name}_missing_inputs", "value": missing},
    ]
    if missing and executor.get("block_on_missing_inputs", False):
        return {
            "connector": connector.name,
            "status": "failed",
            "summary": f"Connector {connector.name} is missing required integration inputs.",
            "artifacts": artifacts,
            "failure_type": "configuration_error",
            "next_recommendation": "Provide required external identifiers before executing this connector.",
        }
    status = "configured" if not missing else "pending_configuration"
    artifacts.append({"type": f"{connector.name}_integration_status", "value": status})
    return {
        "connector": connector.name,
        "status": "completed",
        "summary": spec.get("template", {}).get("summary", f"Prepared integration connector {connector.name}."),
        "artifacts": artifacts,
        "failure_type": None,
        "next_recommendation": spec.get("template", {}).get(
            "next_recommendation",
            "Use integration manifest to route external plugin calls.",
        ),
    }


def _execute_mcp_stdio_connector(connector: ConnectorMeta, spec: dict[str, Any], payload: dict[str, Any]) -> dict[str, Any]:
    executor = spec["executor"]
    server_command = _resolve_payload_command(executor.get("server_command_from_payload_key"), payload)
    bridge_command = _resolve_payload_command(executor.get("bridge_command_from_payload_key"), payload)
    timeout_seconds = int(payload.get("connector_timeout_seconds") or executor.get("timeout_seconds", 30))

    if not server_command:
        if bridge_command:
            bridge_spec = {
                **spec,
                "executor": {
                    "type": "shell",
                    "command_from_payload_key": executor.get("bridge_command_from_payload_key"),
                    "cwd_from_payload_key": executor.get("cwd_from_payload_key"),
                    "timeout_seconds": timeout_seconds,
                },
            }
            return _execute_shell_connector(connector, bridge_spec, payload)
        return _failed_shell_result(
            connector,
            [],
            _resolve_cwd(executor, payload),
            "configuration_error",
            "No MCP server command or bridge command configured.",
        )

    tool_name_key = executor.get("tool_name_from_payload_key", "mcp_tool_name")
    tool_arguments_key = executor.get("tool_arguments_from_payload_key", "mcp_tool_arguments")
    tool_name = payload.get(tool_name_key)
    tool_arguments = payload.get(tool_arguments_key) or {}
    client = None
    try:
        client = MCPStdioClient(server_command, timeout_seconds=timeout_seconds)
        initialize_result = client.initialize()
        tools_result = client.list_tools()
        artifacts = [
            {"type": "mcp_server_command", "value": server_command},
            {"type": "mcp_initialize", "value": initialize_result},
            {"type": "mcp_tools", "value": tools_result},
        ]
        if tool_name:
            tool_result = client.call_tool(str(tool_name), tool_arguments)
            artifacts.append({"type": "mcp_tool_result", "value": tool_result})
        return {
            "connector": connector.name,
            "status": "completed",
            "summary": spec.get("template", {}).get("summary", f"Executed connector {connector.name}."),
            "artifacts": artifacts,
            "next_recommendation": spec.get("template", {}).get(
                "next_recommendation",
                "Use MCP results as structured external tool context.",
            ),
        }
    except (OSError, MCPProtocolError, TimeoutError) as exc:
        return {
            "connector": connector.name,
            "status": "failed",
            "summary": f"Connector {connector.name} failed during MCP stdio execution.",
            "artifacts": [
                {"type": "mcp_server_command", "value": server_command},
                {"type": "stderr", "value": str(exc)},
            ],
            "failure_type": _classify_command_failure(str(exc), connector.name),
            "next_recommendation": "Fix MCP server command, protocol framing, or selected tool arguments.",
        }
    finally:
        if client:
            client.close()


def _resolve_shell_command(executor: dict[str, Any], payload: dict[str, Any]) -> list[str]:
    command_from_payload_key = executor.get("command_from_payload_key")
    resolved = _resolve_payload_command(command_from_payload_key, payload)
    if resolved:
        return resolved
    default_command = executor.get("default_command", [])
    return [str(item) for item in default_command]


def _resolve_payload_command(command_from_payload_key: str | None, payload: dict[str, Any]) -> list[str]:
    if command_from_payload_key:
        value = payload.get(command_from_payload_key)
        if isinstance(value, list) and value:
            return [str(item) for item in value]
    return []


def _resolve_cwd(executor: dict[str, Any], payload: dict[str, Any]) -> Path | None:
    cwd_from_payload_key = executor.get("cwd_from_payload_key")
    if cwd_from_payload_key and payload.get(cwd_from_payload_key):
        return Path(str(payload[cwd_from_payload_key]))
    if payload.get("worktree_path"):
        return Path(str(payload["worktree_path"]))
    if payload.get("path"):
        return Path(str(payload["path"]))
    return None


def _failed_shell_result(
    connector: ConnectorMeta,
    command: list[str],
    cwd: Path | None,
    failure_type: str,
    details: str,
) -> dict[str, Any]:
    return {
        "connector": connector.name,
        "status": "failed",
        "summary": f"Connector {connector.name} failed before execution.",
        "artifacts": [
            {"type": "command", "value": command},
            {"type": "working_directory", "value": str(cwd) if cwd else None},
            {"type": "stderr", "value": details},
        ],
        "failure_type": failure_type,
        "next_recommendation": "Fix connector configuration or command availability before retrying.",
    }


def _resolve_template_value(connector: ConnectorMeta, resolver: str | None, payload: dict[str, Any]) -> Any:
    if resolver == "filesystem_exists":
        target_path = Path(payload.get("path", "."))
        return target_path.exists()
    if resolver == "filesystem_listing":
        target_path = Path(payload.get("path", "."))
        if target_path.exists() and target_path.is_dir():
            return sorted(item.name for item in target_path.iterdir())[:20]
        return []
    if resolver == "browser_target":
        return payload.get("target", "about:blank")
    if resolver == "browser_mode":
        return connector.mode
    if resolver == "ui_acceptance_paths":
        return payload.get("ui_acceptance_paths", [])
    if resolver == "github_repo":
        return payload.get("repo", "unknown")
    if resolver == "github_capabilities":
        return connector.capabilities
    raise ConnectorExecutionError(f"Unsupported connector resolver: {resolver}")


def _classify_command_failure(output: str, connector_name: str) -> str:
    text = output.lower()
    if "permission denied" in text or "not permitted" in text:
        return "permission_error"
    if "authentication failed" in text or "unauthorized" in text or "forbidden" in text:
        return "auth_error"
    if "not found" in text or "no such file" in text or "unknown command" in text or "not a git repository" in text:
        return "configuration_error"
    if connector_name == "test" or "failed" in text or "assert" in text or "error:" in text:
        return "code_error"
    return "unknown"
