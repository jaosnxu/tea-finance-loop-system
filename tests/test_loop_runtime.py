import json
import os
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from loop_engineering.boot import boot_runtime, validate_boot_payload
from loop_engineering.models import BootPayload
from loop_engineering.repository_memory import RepositoryMemory
from loop_engineering.runtime import _trigger_summary_tokens
from loop_engineering.watchdog import evaluate_heartbeat


class LoopRuntimeTests(unittest.TestCase):
    def test_trigger_summary_tokens_drop_boilerplate_words(self) -> None:
        tokens = _trigger_summary_tokens(
            "Use when creating or upgrading a reusable engineering governance system for a workspace."
        )
        self.assertNotIn("use", tokens)
        self.assertNotIn("for", tokens)
        self.assertIn("engineering", tokens)
        self.assertIn("governance", tokens)

    def test_validate_boot_payload_requires_goal(self) -> None:
        with self.assertRaises(ValueError):
            validate_boot_payload(
                BootPayload(
                    goal="",
                    scope={"include": ["a"]},
                    acceptance=["done"],
                    environment={"worktree_root": "/tmp"},
                    policy={"workflow": "fixed"},
                    memory={"record_path": "/tmp", "memory_namespace": "x"},
                )
            )

    def test_boot_and_run_creates_external_state(self) -> None:
        repo_root = Path(__file__).resolve().parents[1]
        with tempfile.TemporaryDirectory() as records_dir, tempfile.TemporaryDirectory() as worktrees_dir:
            payload = BootPayload(
                task_id="TASK-TEST-0001",
                goal="Execute minimal loop runtime.",
                scope={"include": [str(repo_root)]},
                acceptance=["Reach completed state."],
                environment={
                    "source_path": str(repo_root),
                    "worktree_root": worktrees_dir,
                    "available_connectors": ["filesystem"],
                },
                policy={
                    "workflow": "fixed",
                    "retry_limit": 3,
                    "reviewer_required": True,
                    "verifier_required": True,
                    "allow_subagents": True,
                },
                memory={
                    "record_path": records_dir,
                    "memory_namespace": "test-namespace",
                },
            )
            runtime, task_store, memory_store = boot_runtime(
                payload=payload,
                skill_registry_path=str(repo_root / "loop_registry" / "skills.json"),
                connector_registry_path=str(repo_root / "loop_registry" / "connectors.json"),
            )
            runtime.run_until_terminal()
            task_store.save(runtime.context.task_record)
            memory_store.save(runtime.context.memory)

            task_record_path = Path(records_dir) / payload.task_id / "task_record.json"
            trace_path = Path(records_dir) / payload.task_id / "trace.jsonl"
            memory_path = Path(records_dir) / "test-namespace" / "memory.json"
            self.assertTrue(task_record_path.exists())
            self.assertTrue(trace_path.exists())
            self.assertTrue(memory_path.exists())

            task_record = json.loads(task_record_path.read_text(encoding="utf-8"))
            self.assertEqual(task_record["status"], "completed")
            self.assertTrue(task_record["issue_backlog"])
            self.assertTrue(task_record["artifacts"])
            artifact_types = {artifact["type"] for artifact in task_record["artifacts"]}
            self.assertIn("issue_backlog", artifact_types)
            self.assertIn("tool_contracts", artifact_types)
            self.assertIn("module_list", artifact_types)
            self.assertIn("entities", artifact_types)
            self.assertIn("page_map", artifact_types)
            self.assertIn("filesystem_listing", artifact_types)
            self.assertTrue(task_record["active_subagents"])
            memory_data = json.loads(memory_path.read_text(encoding="utf-8"))
            self.assertTrue(memory_data["experience_memory"]["successes"])
            self.assertEqual(memory_data["system_memory"]["workflow_manifest"]["components"]["workflow"], "durable_workflow")
            run_report_path = Path(records_dir) / payload.task_id / "run_report.json"
            self.assertTrue(run_report_path.exists())
            run_report = json.loads(run_report_path.read_text(encoding="utf-8"))
            self.assertEqual(run_report["issue_count"], len(task_record["issue_backlog"]))
            run_summary_path = Path(records_dir) / payload.task_id / "run_summary.json"
            self.assertTrue(run_summary_path.exists())
            run_summary = json.loads(run_summary_path.read_text(encoding="utf-8"))
            self.assertEqual(run_summary["schema_version"], "loop.run_summary.v1")
            self.assertEqual(run_summary["status"], "completed")
            self.assertTrue(run_summary["stages"])

    def test_generic_project_goal_does_not_fallback_to_finance_skills(self) -> None:
        repo_root = Path(__file__).resolve().parents[1]
        with tempfile.TemporaryDirectory() as records_dir, tempfile.TemporaryDirectory() as worktrees_dir:
            payload = BootPayload(
                task_id="TASK-TEST-GENERIC-SKILL-FALLBACK",
                goal="启动 xtgzpt 协同工作平台项目完整循环。",
                scope={"include": ["/tmp/xtgzpt-bootstrap/xtgzpt"], "exclude": ["finance"]},
                acceptance=["读取项目记忆并形成项目执行计划。", "Do not use finance skills for this project."],
                environment={
                    "source_path": str(repo_root),
                    "worktree_root": worktrees_dir,
                    "available_connectors": ["filesystem"],
                },
                policy={
                    "workflow": "fixed",
                    "retry_limit": 3,
                    "reviewer_required": True,
                    "verifier_required": True,
                    "allow_subagents": False,
                },
                memory={
                    "record_path": records_dir,
                    "memory_namespace": "generic-skill-fallback",
                },
            )
            runtime, _, _ = boot_runtime(
                payload=payload,
                skill_registry_path=str(repo_root / "loop_registry" / "skills.json"),
                connector_registry_path=str(repo_root / "loop_registry" / "connectors.json"),
            )
            for _ in range(4):
                runtime.step()
                if runtime.context.task_record.current_stage == "preflight":
                    break

            selected = runtime.context.memory.task_memory["selected_skills"]
            self.assertIn("prd.parse", selected)
            self.assertIn("backend.schema-design", selected)
            self.assertIn("frontend.page-build", selected)
            self.assertFalse(any(name.startswith("finance.") for name in selected))

    def test_network_failure_retries_and_completes_when_cleared(self) -> None:
        repo_root = Path(__file__).resolve().parents[1]
        with tempfile.TemporaryDirectory() as records_dir, tempfile.TemporaryDirectory() as worktrees_dir:
            payload = BootPayload(
                task_id="TASK-TEST-0002",
                goal="Retry network failures.",
                scope={"include": [str(repo_root)]},
                acceptance=["Reach completed state."],
                environment={
                    "source_path": str(repo_root),
                    "worktree_root": worktrees_dir,
                    "available_connectors": ["filesystem"],
                    "simulation": {"failure_type": "network_error"},
                },
                policy={
                    "workflow": "fixed",
                    "retry_limit": 2,
                    "reviewer_required": True,
                    "verifier_required": True,
                    "allow_subagents": True,
                },
                memory={"record_path": records_dir, "memory_namespace": "retry-namespace"},
            )
            runtime, task_store, memory_store = boot_runtime(
                payload=payload,
                skill_registry_path=str(repo_root / "loop_registry" / "skills.json"),
                connector_registry_path=str(repo_root / "loop_registry" / "connectors.json"),
            )
            for _ in range(10):
                runtime.step()
                if runtime.context.task_record.current_stage == "repairing":
                    runtime.context.environment["simulation"] = {}
                if runtime.context.task_record.status in {"completed", "blocked", "aborted"}:
                    break
            task_store.save(runtime.context.task_record)
            memory_store.save(runtime.context.memory)
            self.assertEqual(runtime.context.task_record.status, "completed")
            self.assertGreaterEqual(runtime.context.task_record.retry_count, 1)
            self.assertTrue(runtime.context.memory.experience_memory.get("failures"))

    def test_permission_failure_becomes_intent_debt(self) -> None:
        repo_root = Path(__file__).resolve().parents[1]
        with tempfile.TemporaryDirectory() as records_dir, tempfile.TemporaryDirectory() as worktrees_dir:
            payload = BootPayload(
                task_id="TASK-TEST-0003",
                goal="Block on missing permission.",
                scope={"include": [str(repo_root)]},
                acceptance=["Reach completed state."],
                environment={
                    "source_path": str(repo_root),
                    "worktree_root": worktrees_dir,
                    "available_connectors": ["filesystem"],
                    "simulation": {"failure_type": "permission_error"},
                },
                policy={
                    "workflow": "fixed",
                    "retry_limit": 2,
                    "reviewer_required": True,
                    "verifier_required": True,
                    "allow_subagents": True,
                },
                memory={"record_path": records_dir, "memory_namespace": "blocked-namespace"},
            )
            runtime, task_store, memory_store = boot_runtime(
                payload=payload,
                skill_registry_path=str(repo_root / "loop_registry" / "skills.json"),
                connector_registry_path=str(repo_root / "loop_registry" / "connectors.json"),
            )
            runtime.run_until_terminal()
            task_store.save(runtime.context.task_record)
            memory_store.save(runtime.context.memory)
            self.assertEqual(runtime.context.task_record.status, "blocked")
            self.assertIsNotNone(runtime.context.task_record.intent_debt)

    def test_code_failure_enters_self_repair_cycle_then_completes(self) -> None:
        repo_root = Path(__file__).resolve().parents[1]
        with tempfile.TemporaryDirectory() as records_dir, tempfile.TemporaryDirectory() as worktrees_dir:
            payload = BootPayload(
                task_id="TASK-TEST-CODE-SELF-REPAIR",
                goal="Self repair after code failure.",
                scope={"include": [str(repo_root)]},
                acceptance=["Reach completed state after repair."],
                environment={
                    "source_path": str(repo_root),
                    "worktree_root": worktrees_dir,
                    "available_connectors": ["filesystem"],
                    "simulation": {"failure_type": "code_error"},
                },
                policy={
                    "workflow": "durable_workflow",
                    "retry_limit": 1,
                    "self_repair_limit": 2,
                    "reviewer_required": True,
                    "verifier_required": True,
                    "allow_subagents": False,
                },
                memory={"record_path": records_dir, "memory_namespace": "code-self-repair-namespace"},
            )
            runtime, task_store, memory_store = boot_runtime(
                payload=payload,
                skill_registry_path=str(repo_root / "loop_registry" / "skills.json"),
                connector_registry_path=str(repo_root / "loop_registry" / "connectors.json"),
            )
            for _ in range(16):
                runtime.step()
                if runtime.context.task_record.repair_count >= 1 and runtime.context.task_record.current_stage == "planning":
                    runtime.context.environment["simulation"] = {}
                if runtime.context.task_record.status in {"completed", "blocked", "aborted"}:
                    break
            task_store.save(runtime.context.task_record)
            memory_store.save(runtime.context.memory)

            self.assertEqual(runtime.context.task_record.status, "completed")
            self.assertEqual(runtime.context.task_record.repair_count, 1)
            artifact_types = {artifact["type"] for artifact in runtime.context.task_record.artifacts}
            self.assertIn("self_repair_plan", artifact_types)
            run_summary = json.loads((Path(records_dir) / payload.task_id / "run_summary.json").read_text(encoding="utf-8"))
            self.assertEqual(run_summary["repair_count"], 1)

    def test_code_failure_blocks_after_self_repair_limit(self) -> None:
        repo_root = Path(__file__).resolve().parents[1]
        with tempfile.TemporaryDirectory() as records_dir, tempfile.TemporaryDirectory() as worktrees_dir:
            payload = BootPayload(
                task_id="TASK-TEST-CODE-SELF-REPAIR-LIMIT",
                goal="Stop after self repair budget is exhausted.",
                scope={"include": [str(repo_root)]},
                acceptance=["Block after repair limit."],
                environment={
                    "source_path": str(repo_root),
                    "worktree_root": worktrees_dir,
                    "available_connectors": ["filesystem"],
                    "simulation": {"failure_type": "code_error"},
                },
                policy={
                    "workflow": "durable_workflow",
                    "retry_limit": 1,
                    "self_repair_limit": 1,
                    "reviewer_required": True,
                    "verifier_required": True,
                    "allow_subagents": False,
                },
                memory={"record_path": records_dir, "memory_namespace": "code-self-repair-limit-namespace"},
            )
            runtime, task_store, memory_store = boot_runtime(
                payload=payload,
                skill_registry_path=str(repo_root / "loop_registry" / "skills.json"),
                connector_registry_path=str(repo_root / "loop_registry" / "connectors.json"),
            )
            runtime.run_until_terminal(max_steps=16)
            task_store.save(runtime.context.task_record)
            memory_store.save(runtime.context.memory)

            self.assertEqual(runtime.context.task_record.status, "blocked")
            self.assertEqual(runtime.context.task_record.repair_count, 1)
            self.assertIsNotNone(runtime.context.task_record.intent_debt)
            self.assertEqual(runtime.context.task_record.intent_debt["reason"], "self-repair limit exhausted")

    def test_tool_policy_blocks_high_risk_connector_and_creates_approval_request(self) -> None:
        repo_root = Path(__file__).resolve().parents[1]
        with tempfile.TemporaryDirectory() as records_dir, tempfile.TemporaryDirectory() as worktrees_dir, tempfile.TemporaryDirectory() as repo_dir:
            payload = BootPayload(
                task_id="TASK-TEST-TOOL-POLICY-APPROVAL",
                goal="Use GitHub connector with approval policy.",
                scope={"include": [str(repo_dir)]},
                acceptance=["Block before high-risk connector executes."],
                environment={
                    "source_path": str(repo_dir),
                    "repository_root": str(repo_dir),
                    "repository_memory_path": "memory",
                    "worktree_root": worktrees_dir,
                    "available_connectors": ["github"],
                    "repo": "owner/repo",
                },
                policy={
                    "workflow": "durable_workflow",
                    "enforce_tool_policy": True,
                    "require_approval_for_high_risk_tools": True,
                    "reviewer_required": True,
                    "verifier_required": True,
                    "allow_subagents": False,
                },
                memory={"record_path": records_dir, "memory_namespace": "tool-policy-namespace"},
            )
            runtime, task_store, memory_store = boot_runtime(
                payload=payload,
                skill_registry_path=str(repo_root / "loop_registry" / "skills.json"),
                connector_registry_path=str(repo_root / "loop_registry" / "connectors.json"),
            )
            runtime.run_until_terminal(max_steps=8)
            task_store.save(runtime.context.task_record)
            memory_store.save(runtime.context.memory)

            approvals = RepositoryMemory(Path(repo_dir) / "memory").list_approval_requests(status="open")
            artifact_types = {artifact["type"] for artifact in runtime.context.task_record.artifacts}

            self.assertEqual(runtime.context.task_record.status, "blocked")
            self.assertEqual(runtime.context.task_record.intent_debt["failure_type"], "permission_error")
            self.assertTrue(approvals)
            self.assertEqual(approvals[-1]["subject"], "github")
            self.assertIn("approval_request", artifact_types)

    def test_eval_gate_failure_enters_repair_path(self) -> None:
        repo_root = Path(__file__).resolve().parents[1]
        with tempfile.TemporaryDirectory() as records_dir, tempfile.TemporaryDirectory() as worktrees_dir:
            payload = BootPayload(
                task_id="TASK-TEST-EVAL-GATE",
                goal="Run eval gate.",
                scope={"include": [str(repo_root)]},
                acceptance=["Fail eval when artifact is missing."],
                environment={
                    "source_path": str(repo_root),
                    "worktree_root": worktrees_dir,
                    "available_connectors": ["filesystem"],
                    "eval_cases": [
                        {
                            "name": "requires-nonexistent-artifact",
                            "required_artifacts": ["nonexistent_artifact"],
                        }
                    ],
                },
                policy={
                    "workflow": "durable_workflow",
                    "retry_limit": 0,
                    "self_repair_limit": 0,
                    "reviewer_required": True,
                    "verifier_required": True,
                    "allow_subagents": False,
                },
                memory={"record_path": records_dir, "memory_namespace": "eval-gate-namespace"},
            )
            runtime, task_store, memory_store = boot_runtime(
                payload=payload,
                skill_registry_path=str(repo_root / "loop_registry" / "skills.json"),
                connector_registry_path=str(repo_root / "loop_registry" / "connectors.json"),
            )
            runtime.run_until_terminal(max_steps=12)
            task_store.save(runtime.context.task_record)
            memory_store.save(runtime.context.memory)

            artifact_types = {artifact["type"] for artifact in runtime.context.task_record.artifacts}
            self.assertEqual(runtime.context.task_record.status, "blocked")
            self.assertIn("eval_summary", artifact_types)
            self.assertEqual(runtime.context.task_record.intent_debt["failure_type"], "code_error")

    def test_runtime_executes_git_cli_test_and_mcp_connectors(self) -> None:
        repo_root = Path(__file__).resolve().parents[1]
        with tempfile.TemporaryDirectory() as records_dir, tempfile.TemporaryDirectory() as worktrees_dir, tempfile.TemporaryDirectory() as git_repo_dir:
            subprocess.run(["git", "init"], cwd=git_repo_dir, check=True, capture_output=True, text=True)
            payload = BootPayload(
                task_id="TASK-TEST-0004",
                goal="Run git, cli, test, and mcp connectors for verification.",
                scope={"include": [str(git_repo_dir)]},
                acceptance=["Reach completed state."],
                environment={
                    "source_path": str(git_repo_dir),
                    "worktree_root": worktrees_dir,
                    "available_connectors": ["filesystem", "git", "cli", "test", "mcp"],
                    "git_command": ["git", "status", "--short"],
                    "cli_command": ["python3", "-c", "print('loop-cli-ok')"],
                    "test_command": ["python3", "-c", "print('loop-test-ok')"],
                    "mcp_command": ["/bin/echo", "loop-mcp-ok"],
                },
                policy={
                    "workflow": "fixed",
                    "retry_limit": 1,
                    "reviewer_required": True,
                    "verifier_required": True,
                    "require_test_artifact": True,
                    "require_vcs_artifact": True,
                    "merge_gate_required": True,
                    "allow_subagents": False,
                },
                memory={"record_path": records_dir, "memory_namespace": "connector-namespace"},
            )
            runtime, task_store, memory_store = boot_runtime(
                payload=payload,
                skill_registry_path=str(repo_root / "loop_registry" / "skills.json"),
                connector_registry_path=str(repo_root / "loop_registry" / "connectors.json"),
            )
            runtime.run_until_terminal()
            task_store.save(runtime.context.task_record)
            memory_store.save(runtime.context.memory)

            self.assertEqual(runtime.context.task_record.status, "completed")
            connector_outputs = runtime.context.memory.task_memory["connector_outputs"]
            connector_names = {item["connector"] for item in connector_outputs}
            self.assertIn("git", connector_names)
            self.assertIn("cli", connector_names)
            self.assertIn("test", connector_names)
            self.assertIn("mcp", connector_names)
            artifact_types = {artifact["type"] for artifact in runtime.context.task_record.artifacts}
            self.assertIn("vcs_commit_plan", artifact_types)
            self.assertIn("ci_suite_summary", artifact_types)
            self.assertIn("tool_contracts", artifact_types)
            self.assertEqual(runtime.context.task_record.gate_status["preflight_gate"]["status"], "passed")
            self.assertEqual(runtime.context.task_record.gate_status["merge_gate"]["status"], "passed")

    def test_runtime_executes_codex_before_git_without_writing_source_path(self) -> None:
        repo_root = Path(__file__).resolve().parents[1]
        with tempfile.TemporaryDirectory() as records_dir, tempfile.TemporaryDirectory() as worktrees_dir, tempfile.TemporaryDirectory() as git_repo_dir:
            subprocess.run(["git", "init"], cwd=git_repo_dir, check=True, capture_output=True, text=True)
            payload = BootPayload(
                task_id="TASK-TEST-CODEX-GIT-ORDER",
                goal="Execute implementation through Codex in an isolated worktree, then inspect git state.",
                scope={"include": [str(git_repo_dir)]},
                acceptance=["Codex writes before git inspection without touching source path."],
                environment={
                    "source_path": str(git_repo_dir),
                    "worktree_root": worktrees_dir,
                    "available_connectors": ["codex_executor", "git"],
                    "codex_command": ["python3", "-c", "print('loop-codex-ok')"],
                    "git_base_ref": "HEAD",
                },
                policy={
                    "workflow": "fixed",
                    "retry_limit": 0,
                    "reviewer_required": True,
                    "verifier_required": True,
                    "allow_subagents": False,
                },
                memory={"record_path": records_dir, "memory_namespace": "codex-git-order"},
            )
            runtime, _, _ = boot_runtime(
                payload=payload,
                skill_registry_path=str(repo_root / "loop_registry" / "skills.json"),
                connector_registry_path=str(repo_root / "loop_registry" / "connectors.json"),
            )
            runtime.context.task_record.current_stage = "executing"
            runtime.context.memory.task_memory["selected_connectors"] = ["git", "codex_executor"]

            seen_calls: list[tuple[str, dict]] = []

            def fake_execute(connector, connector_payload):
                seen_calls.append((connector.name, dict(connector_payload)))
                return {
                    "connector": connector.name,
                    "status": "completed",
                    "summary": f"Executed {connector.name}.",
                    "artifacts": [],
                    "next_recommendation": "",
                }

            with patch("loop_engineering.runtime.execute_connector", side_effect=fake_execute):
                result = runtime.step()

            self.assertEqual(result.status, "done")
            self.assertNotEqual(runtime.context.primary_worktree.path, str(git_repo_dir))
            self.assertEqual([name for name, _ in seen_calls], ["codex_executor", "git"])
            for _, connector_payload in seen_calls:
                self.assertEqual(connector_payload["worktree_path"], runtime.context.primary_worktree.path)
                self.assertEqual(connector_payload["git_path"], str(git_repo_dir))
                self.assertEqual(connector_payload["codex_path"], runtime.context.primary_worktree.path)
                self.assertNotEqual(connector_payload["codex_path"], str(git_repo_dir))

    def test_runtime_can_resume_existing_durable_state(self) -> None:
        repo_root = Path(__file__).resolve().parents[1]
        with tempfile.TemporaryDirectory() as records_dir, tempfile.TemporaryDirectory() as worktrees_dir:
            payload = BootPayload(
                task_id="TASK-TEST-RESUME",
                goal="Resume durable loop runtime.",
                scope={"include": [str(repo_root)]},
                acceptance=["Reach completed state."],
                environment={
                    "source_path": str(repo_root),
                    "worktree_root": worktrees_dir,
                    "available_connectors": ["filesystem"],
                },
                policy={
                    "workflow": "durable_workflow",
                    "retry_limit": 3,
                    "reviewer_required": True,
                    "verifier_required": True,
                    "allow_subagents": False,
                },
                memory={"record_path": records_dir, "memory_namespace": "resume-namespace"},
            )
            runtime, task_store, memory_store = boot_runtime(
                payload=payload,
                skill_registry_path=str(repo_root / "loop_registry" / "skills.json"),
                connector_registry_path=str(repo_root / "loop_registry" / "connectors.json"),
            )
            runtime.step()
            runtime.step()
            task_store.save(runtime.context.task_record)
            memory_store.save(runtime.context.memory)
            worktree_id = runtime.context.primary_worktree.worktree_id

            resumed, resumed_task_store, resumed_memory_store = boot_runtime(
                payload=payload,
                skill_registry_path=str(repo_root / "loop_registry" / "skills.json"),
                connector_registry_path=str(repo_root / "loop_registry" / "connectors.json"),
                resume_existing=True,
            )
            self.assertEqual(resumed.context.task_record.current_stage, "planning")
            self.assertEqual(resumed.context.primary_worktree.worktree_id, worktree_id)
            resumed.run_until_terminal()
            resumed_task_store.save(resumed.context.task_record)
            resumed_memory_store.save(resumed.context.memory)
            self.assertEqual(resumed.context.task_record.status, "completed")

    def test_preflight_blocks_missing_connector_auth(self) -> None:
        repo_root = Path(__file__).resolve().parents[1]
        with tempfile.TemporaryDirectory() as records_dir, tempfile.TemporaryDirectory() as worktrees_dir:
            payload = BootPayload(
                task_id="TASK-TEST-PREFLIGHT",
                goal="Use GitHub connector with required auth.",
                scope={"include": [str(repo_root)]},
                acceptance=["Block before execution when auth is missing."],
                environment={
                    "source_path": str(repo_root),
                    "worktree_root": worktrees_dir,
                    "available_connectors": ["github"],
                    "repo": "owner/repo",
                },
                policy={
                    "workflow": "durable_workflow",
                    "retry_limit": 1,
                    "reviewer_required": True,
                    "verifier_required": True,
                    "enforce_connector_auth": True,
                    "allow_subagents": False,
                },
                memory={"record_path": records_dir, "memory_namespace": "preflight-namespace"},
            )
            runtime, task_store, memory_store = boot_runtime(
                payload=payload,
                skill_registry_path=str(repo_root / "loop_registry" / "skills.json"),
                connector_registry_path=str(repo_root / "loop_registry" / "connectors.json"),
            )
            runtime.run_until_terminal()
            task_store.save(runtime.context.task_record)
            memory_store.save(runtime.context.memory)
            self.assertEqual(runtime.context.task_record.status, "blocked")
            self.assertEqual(runtime.context.task_record.current_stage, "blocked")
            self.assertEqual(runtime.context.task_record.gate_status["preflight_gate"]["status"], "blocked")

    def test_preflight_accepts_auth_from_environment_variable(self) -> None:
        repo_root = Path(__file__).resolve().parents[1]
        previous = os.environ.get("LOOP_TEST_GITHUB_TOKEN")
        os.environ["LOOP_TEST_GITHUB_TOKEN"] = "token-for-test"
        try:
            with tempfile.TemporaryDirectory() as records_dir, tempfile.TemporaryDirectory() as worktrees_dir:
                payload = BootPayload(
                    task_id="TASK-TEST-PREFLIGHT-ENV",
                    goal="Use GitHub connector with env auth.",
                    scope={"include": [str(repo_root)]},
                    acceptance=["Complete when auth is present."],
                    environment={
                        "source_path": str(repo_root),
                        "worktree_root": worktrees_dir,
                        "available_connectors": ["github"],
                        "repo": "owner/repo",
                        "auth_env": {"token": "LOOP_TEST_GITHUB_TOKEN"},
                    },
                    policy={
                        "workflow": "durable_workflow",
                        "retry_limit": 1,
                        "reviewer_required": True,
                        "verifier_required": True,
                        "enforce_connector_auth": True,
                        "allow_subagents": False,
                    },
                    memory={"record_path": records_dir, "memory_namespace": "preflight-env-namespace"},
                )
                runtime, task_store, memory_store = boot_runtime(
                    payload=payload,
                    skill_registry_path=str(repo_root / "loop_registry" / "skills.json"),
                    connector_registry_path=str(repo_root / "loop_registry" / "connectors.json"),
                )
                runtime.run_until_terminal()
                task_store.save(runtime.context.task_record)
                memory_store.save(runtime.context.memory)
                self.assertEqual(runtime.context.task_record.status, "completed")
                self.assertEqual(runtime.context.task_record.gate_status["preflight_gate"]["status"], "passed")
        finally:
            if previous is None:
                os.environ.pop("LOOP_TEST_GITHUB_TOKEN", None)
            else:
                os.environ["LOOP_TEST_GITHUB_TOKEN"] = previous

    def test_watchdog_reports_healthy_heartbeat(self) -> None:
        repo_root = Path(__file__).resolve().parents[1]
        with tempfile.TemporaryDirectory() as records_dir, tempfile.TemporaryDirectory() as worktrees_dir:
            payload = BootPayload(
                task_id="TASK-TEST-WATCHDOG",
                goal="Check watchdog.",
                scope={"include": [str(repo_root)]},
                acceptance=["Heartbeat is healthy."],
                environment={
                    "source_path": str(repo_root),
                    "worktree_root": worktrees_dir,
                    "available_connectors": ["filesystem"],
                },
                policy={
                    "workflow": "durable_workflow",
                    "retry_limit": 1,
                    "reviewer_required": False,
                    "verifier_required": False,
                    "allow_subagents": False,
                },
                memory={"record_path": records_dir, "memory_namespace": "watchdog-namespace"},
            )
            runtime, _, _ = boot_runtime(
                payload=payload,
                skill_registry_path=str(repo_root / "loop_registry" / "skills.json"),
                connector_registry_path=str(repo_root / "loop_registry" / "connectors.json"),
            )
            status = evaluate_heartbeat(runtime.context.task_record, timeout_seconds=300)
            self.assertEqual(status["status"], "healthy")

    def test_merge_gate_accepts_available_github_remote_status(self) -> None:
        repo_root = Path(__file__).resolve().parents[1]
        with tempfile.TemporaryDirectory() as records_dir, tempfile.TemporaryDirectory() as worktrees_dir:
            payload = BootPayload(
                task_id="TASK-TEST-GITHUB-MERGE",
                goal="Run GitHub remote PR merge gate.",
                scope={"include": [str(repo_root)]},
                acceptance=["Remote PR status is available."],
                environment={
                    "source_path": str(repo_root),
                    "worktree_root": worktrees_dir,
                    "available_connectors": ["github"],
                    "repo": "owner/repo",
                    "github_command": ["python3", "-c", "import json; print(json.dumps({'state':'success'}))"],
                },
                policy={
                    "workflow": "durable_workflow",
                    "retry_limit": 1,
                    "reviewer_required": True,
                    "verifier_required": True,
                    "merge_gate_required": True,
                    "require_remote_pr_artifact": True,
                    "allow_subagents": False,
                },
                memory={"record_path": records_dir, "memory_namespace": "github-merge-namespace"},
            )
            runtime, task_store, memory_store = boot_runtime(
                payload=payload,
                skill_registry_path=str(repo_root / "loop_registry" / "skills.json"),
                connector_registry_path=str(repo_root / "loop_registry" / "connectors.json"),
            )
            runtime.run_until_terminal()
            task_store.save(runtime.context.task_record)
            memory_store.save(runtime.context.memory)
            self.assertEqual(runtime.context.task_record.status, "completed")
            self.assertEqual(runtime.context.task_record.gate_status["merge_gate"]["status"], "passed")
            artifact_types = {artifact["type"] for artifact in runtime.context.task_record.artifacts}
            self.assertIn("github_remote_status", artifact_types)

    def test_merge_gate_blocks_failed_remote_status_checks(self) -> None:
        repo_root = Path(__file__).resolve().parents[1]
        with tempfile.TemporaryDirectory() as records_dir, tempfile.TemporaryDirectory() as worktrees_dir:
            payload = BootPayload(
                task_id="TASK-TEST-GITHUB-MERGE-BLOCKED",
                goal="Block when GitHub remote checks are failing.",
                scope={"include": [str(repo_root)]},
                acceptance=["Remote PR checks must be successful."],
                environment={
                    "source_path": str(repo_root),
                    "worktree_root": worktrees_dir,
                    "available_connectors": ["github"],
                    "repo": "owner/repo",
                    "github_command": ["python3", "-c", "import json; print(json.dumps({'state':'failure'}))"],
                },
                policy={
                    "workflow": "durable_workflow",
                    "retry_limit": 1,
                    "reviewer_required": True,
                    "verifier_required": True,
                    "merge_gate_required": True,
                    "require_remote_pr_artifact": True,
                    "require_remote_status_success": True,
                    "allow_subagents": False,
                },
                memory={"record_path": records_dir, "memory_namespace": "github-merge-blocked-namespace"},
            )
            runtime, task_store, memory_store = boot_runtime(
                payload=payload,
                skill_registry_path=str(repo_root / "loop_registry" / "skills.json"),
                connector_registry_path=str(repo_root / "loop_registry" / "connectors.json"),
            )
            runtime.run_until_terminal()
            task_store.save(runtime.context.task_record)
            memory_store.save(runtime.context.memory)
            self.assertEqual(runtime.context.task_record.status, "blocked")
            self.assertEqual(runtime.context.task_record.gate_status["merge_gate"]["status"], "blocked")
            self.assertEqual(
                runtime.context.task_record.gate_status["merge_gate"]["reason"],
                "GitHub remote status checks are not successful",
            )

    def test_runtime_routes_figma_and_product_design_connectors(self) -> None:
        repo_root = Path(__file__).resolve().parents[1]
        with tempfile.TemporaryDirectory() as records_dir, tempfile.TemporaryDirectory() as worktrees_dir:
            payload = BootPayload(
                task_id="TASK-TEST-DESIGN-INTEGRATIONS",
                goal="Connect Figma and Product Design integrations.",
                scope={"include": [str(repo_root)]},
                acceptance=["Design integrations are prepared."],
                environment={
                    "source_path": str(repo_root),
                    "worktree_root": worktrees_dir,
                    "available_connectors": ["figma", "product_design"],
                    "provided_auth": ["figma_session"],
                    "figma_file_key": "figma-test-file",
                    "product_design_brief": "Russian tea-chain admin product redesign.",
                },
                policy={
                    "workflow": "durable_workflow",
                    "retry_limit": 1,
                    "reviewer_required": True,
                    "verifier_required": True,
                    "enforce_connector_auth": True,
                    "allow_subagents": False,
                },
                memory={"record_path": records_dir, "memory_namespace": "design-integrations-namespace"},
            )
            runtime, task_store, memory_store = boot_runtime(
                payload=payload,
                skill_registry_path=str(repo_root / "loop_registry" / "skills.json"),
                connector_registry_path=str(repo_root / "loop_registry" / "connectors.json"),
            )
            runtime.run_until_terminal()
            task_store.save(runtime.context.task_record)
            memory_store.save(runtime.context.memory)
            self.assertEqual(runtime.context.task_record.status, "completed")
            connector_outputs = runtime.context.memory.task_memory["connector_outputs"]
            connector_names = {item["connector"] for item in connector_outputs}
            self.assertIn("figma", connector_names)
            self.assertIn("product_design", connector_names)
            artifact_types = {artifact["type"] for artifact in runtime.context.task_record.artifacts}
            self.assertIn("figma_integration_manifest", artifact_types)
            self.assertIn("product_design_integration_manifest", artifact_types)


if __name__ == "__main__":
    unittest.main()
