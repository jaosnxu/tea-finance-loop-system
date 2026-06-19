import json
import subprocess
import tempfile
import unittest
from pathlib import Path

from loop_engineering.command_resolution import environment_for_command
from loop_engineering.connector_runner import execute_connector
from loop_engineering.models import ConnectorMeta


REPO_ROOT = Path(__file__).resolve().parents[1]


def _connector_meta(name: str, target: str, entry: str) -> ConnectorMeta:
    return ConnectorMeta(
        name=name,
        version="v1",
        status="core",
        target=target,
        capabilities=[],
        risk_level="low",
        mode="read_write",
        auth_requirements=[],
        entry=str(REPO_ROOT / entry),
        input_schema="",
        output_schema="",
        priority=1,
    )


class ConnectorExecutionTests(unittest.TestCase):
    def test_git_connector_executes_status_command(self) -> None:
        with tempfile.TemporaryDirectory() as repo_dir:
            subprocess.run(["git", "init"], cwd=repo_dir, check=True, capture_output=True, text=True)
            Path(repo_dir, "example.txt").write_text("changed", encoding="utf-8")
            result = execute_connector(
                _connector_meta("git", "git", "loop_registry/connectors/git.v1.json"),
                {
                    "git_path": repo_dir,
                },
            )
            self.assertEqual(result["status"], "completed")
            artifact_types = {artifact["type"] for artifact in result["artifacts"]}
            self.assertIn("vcs_commit_plan", artifact_types)
            changed_files = next(artifact["value"] for artifact in result["artifacts"] if artifact["type"] == "vcs_changed_files")
            self.assertIn("example.txt", changed_files)

    def test_test_connector_executes_command(self) -> None:
        result = execute_connector(
            _connector_meta("test", "test", "loop_registry/connectors/test.v1.json"),
            {
                "test_command": ["python3", "-c", "print('ok-from-test')"],
                "worktree_path": str(REPO_ROOT),
            },
        )
        self.assertEqual(result["status"], "completed")
        summary = next(artifact["value"] for artifact in result["artifacts"] if artifact["type"] == "ci_suite_summary")
        self.assertEqual(summary["passed"], 1)

    def test_test_connector_resolves_executable_with_login_shell_path(self) -> None:
        result = execute_connector(
            _connector_meta("test", "test", "loop_registry/connectors/test.v1.json"),
            {
                "test_command": ["python3", "-c", "print('resolved-command-ok')"],
                "worktree_path": str(REPO_ROOT),
            },
        )
        self.assertEqual(result["status"], "completed")
        results = next(artifact["value"] for artifact in result["artifacts"] if artifact["type"] == "ci_suite_results")
        self.assertTrue(results[0]["command"][0].endswith("python3"))

    def test_resolved_command_directory_is_added_to_path(self) -> None:
        env = environment_for_command(["/tmp/example-tool/bin/npm", "run", "ci"], base_env={"PATH": "/usr/bin"})
        self.assertEqual(env["PATH"].split(":")[0], "/tmp/example-tool/bin")

    def test_cli_connector_executes_command(self) -> None:
        result = execute_connector(
            _connector_meta("cli", "cli", "loop_registry/connectors/cli.v1.json"),
            {
                "cli_command": ["python3", "-c", "print('ok-from-cli')"],
                "cli_path": str(REPO_ROOT),
            },
        )
        self.assertEqual(result["status"], "completed")
        stdout = next(artifact["value"] for artifact in result["artifacts"] if artifact["type"] == "stdout")
        self.assertIn("ok-from-cli", stdout)

    def test_mcp_connector_executes_bridge_command(self) -> None:
        result = execute_connector(
            _connector_meta("mcp", "mcp", "loop_registry/connectors/mcp.v1.json"),
            {
                "mcp_command": ["/bin/echo", "bridge-ok"],
                "worktree_path": str(REPO_ROOT),
            },
        )
        self.assertEqual(result["status"], "completed")
        stdout = next(artifact["value"] for artifact in result["artifacts"] if artifact["type"] == "stdout")
        self.assertEqual(stdout, "bridge-ok")

    def test_browser_connector_reports_ui_acceptance_paths(self) -> None:
        result = execute_connector(
            _connector_meta("browser", "browser", "loop_registry/connectors/browser.v1.json"),
            {
                "target": "http://localhost:3000",
                "ui_acceptance_paths": ["/login", "/dashboard"],
            },
        )
        self.assertEqual(result["status"], "completed")
        paths = next(artifact["value"] for artifact in result["artifacts"] if artifact["type"] == "ui_acceptance_paths")
        self.assertEqual(paths, ["/login", "/dashboard"])

    def test_mcp_connector_executes_stdio_protocol(self) -> None:
        server_code = r'''
import json
import sys

def read_message():
    content_length = None
    while True:
        line = sys.stdin.buffer.readline()
        if not line:
            raise SystemExit(0)
        if line in (b"\r\n", b"\n"):
            break
        key, _, value = line.decode("ascii").partition(":")
        if key.lower() == "content-length":
            content_length = int(value.strip())
    body = sys.stdin.buffer.read(content_length)
    return json.loads(body.decode("utf-8"))

def write_message(payload):
    body = json.dumps(payload).encode("utf-8")
    sys.stdout.buffer.write(f"Content-Length: {len(body)}\r\n\r\n".encode("ascii") + body)
    sys.stdout.buffer.flush()

while True:
    message = read_message()
    if "id" not in message:
        continue
    method = message["method"]
    if method == "initialize":
        result = {"protocolVersion": "2024-11-05", "capabilities": {}, "serverInfo": {"name": "mock-mcp"}}
    elif method == "tools/list":
        result = {"tools": [{"name": "echo", "inputSchema": {"type": "object"}}]}
    elif method == "tools/call":
        result = {"content": [{"type": "text", "text": message["params"]["arguments"]["text"]}]}
    else:
        result = {}
    write_message({"jsonrpc": "2.0", "id": message["id"], "result": result})
'''
        with tempfile.TemporaryDirectory() as tmp_dir:
            server_path = Path(tmp_dir) / "mock_mcp_server.py"
            server_path.write_text(server_code, encoding="utf-8")
            result = execute_connector(
                _connector_meta("mcp", "mcp", "loop_registry/connectors/mcp.v1.json"),
                {
                    "mcp_server_command": ["python3", str(server_path)],
                    "mcp_tool_name": "echo",
                    "mcp_tool_arguments": {"text": "stdio-ok"},
                    "worktree_path": str(REPO_ROOT),
                },
            )
        self.assertEqual(result["status"], "completed")
        artifact_types = {artifact["type"] for artifact in result["artifacts"]}
        self.assertIn("mcp_initialize", artifact_types)
        tool_result = next(artifact["value"] for artifact in result["artifacts"] if artifact["type"] == "mcp_tool_result")
        self.assertEqual(tool_result["content"][0]["text"], "stdio-ok")

    def test_github_connector_prepares_pr_plan_without_remote_command(self) -> None:
        result = execute_connector(
            _connector_meta("github", "github", "loop_registry/connectors/github.v1.json"),
            {
                "repo": "owner/repo",
                "github_head_ref": "loop/test",
                "github_base_ref": "main",
            },
        )
        self.assertEqual(result["status"], "completed")
        artifact_types = {artifact["type"] for artifact in result["artifacts"]}
        self.assertIn("github_pr_plan", artifact_types)
        plan = next(artifact["value"] for artifact in result["artifacts"] if artifact["type"] == "github_pr_plan")
        self.assertIn("open_draft_pr", plan["workflow_steps"])
        self.assertIn("remote_status_checks", plan["required_gates"])
        remote = next(artifact["value"] for artifact in result["artifacts"] if artifact["type"] == "github_remote_status")
        self.assertFalse(remote["available"])

    def test_github_connector_reads_remote_status_command(self) -> None:
        result = execute_connector(
            _connector_meta("github", "github", "loop_registry/connectors/github.v1.json"),
            {
                "repo": "owner/repo",
                "github_command": ["python3", "-c", "import json; print(json.dumps({'state':'success'}))"],
            },
        )
        self.assertEqual(result["status"], "completed")
        remote = next(artifact["value"] for artifact in result["artifacts"] if artifact["type"] == "github_remote_status")
        self.assertTrue(remote["available"])
        self.assertEqual(remote["json"]["state"], "success")

    def test_figma_connector_prepares_integration_manifest(self) -> None:
        result = execute_connector(
            _connector_meta("figma", "figma", "loop_registry/connectors/figma.v1.json"),
            {
                "figma_file_key": "file123",
            },
        )
        self.assertEqual(result["status"], "completed")
        manifest = next(artifact["value"] for artifact in result["artifacts"] if artifact["type"] == "figma_integration_manifest")
        self.assertEqual(manifest["standard_name"], "figma_canvas_adapter")

    def test_product_design_connector_prepares_workflow_manifest(self) -> None:
        result = execute_connector(
            _connector_meta("product_design", "product_design", "loop_registry/connectors/product_design.v1.json"),
            {
                "product_design_brief": "Improve finance dashboard UX.",
            },
        )
        self.assertEqual(result["status"], "completed")
        manifest = next(
            artifact["value"]
            for artifact in result["artifacts"]
            if artifact["type"] == "product_design_integration_manifest"
        )
        self.assertEqual(manifest["standard_name"], "product_design_workflow_adapter")

    def test_connector_failure_is_classified(self) -> None:
        result = execute_connector(
            _connector_meta("test", "test", "loop_registry/connectors/test.v1.json"),
            {
                "test_command": ["python3", "-c", "raise SystemExit(2)"],
                "worktree_path": str(REPO_ROOT),
            },
        )
        self.assertEqual(result["status"], "failed")
        self.assertEqual(result["failure_type"], "code_error")

    def test_ci_connector_runs_multiple_suites(self) -> None:
        result = execute_connector(
            _connector_meta("test", "test", "loop_registry/connectors/test.v1.json"),
            {
                "test_suites": [
                    {"name": "unit", "command": ["python3", "-c", "print('unit-ok')"]},
                    {"name": "build", "command": ["python3", "-c", "print('build-ok')"]},
                ],
                "worktree_path": str(REPO_ROOT),
            },
        )
        self.assertEqual(result["status"], "completed")
        summary = next(artifact["value"] for artifact in result["artifacts"] if artifact["type"] == "ci_suite_summary")
        self.assertEqual(summary["total"], 2)
        self.assertEqual(summary["passed"], 2)

    def test_ci_connector_runs_setup_before_suite(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            marker = Path(tmp_dir) / "setup-marker.txt"
            result = execute_connector(
                _connector_meta("test", "test", "loop_registry/connectors/test.v1.json"),
                {
                    "test_setup_command": ["python3", "-c", f"from pathlib import Path; Path({str(marker)!r}).write_text('ready')"],
                    "test_command": ["python3", "-c", f"from pathlib import Path; raise SystemExit(0 if Path({str(marker)!r}).exists() else 2)"],
                    "worktree_path": tmp_dir,
                },
            )
        self.assertEqual(result["status"], "completed")
        setup = next(artifact["value"] for artifact in result["artifacts"] if artifact["type"] == "ci_setup_result")
        self.assertEqual(setup["status"], "passed")


if __name__ == "__main__":
    unittest.main()
