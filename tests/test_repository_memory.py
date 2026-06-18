import json
import subprocess
import tempfile
import unittest
from pathlib import Path

from loop_engineering.boot import boot_runtime
from loop_engineering.models import BootPayload
from loop_engineering.repository_memory import RepositoryMemory


class RepositoryMemoryTests(unittest.TestCase):
    def test_repository_memory_initializes_required_files(self) -> None:
        with tempfile.TemporaryDirectory() as root_dir:
            memory = RepositoryMemory(Path(root_dir) / "memory")
            snapshot = memory.read_required_context()

            self.assertTrue((Path(root_dir) / "memory" / "README.md").exists())
            self.assertTrue((Path(root_dir) / "memory" / "projects" / "tea-finance-system.md").exists())
            self.assertTrue((Path(root_dir) / "memory" / "experience" / "successes.jsonl").exists())
            self.assertTrue((Path(root_dir) / "memory" / "intent_debt.jsonl").exists())
            self.assertTrue((Path(root_dir) / "memory" / "issues" / "loop-system-issues.jsonl").exists())
            self.assertTrue((Path(root_dir) / "memory" / "regression_candidates.jsonl").exists())
            self.assertTrue((Path(root_dir) / "memory" / "current_status.json").exists())
            self.assertIn("project_standards.md", snapshot["files"])
            self.assertIn("verification/regression_policy.md", snapshot["files"])
            self.assertIn("backlog/loop-engineering.json", snapshot["files"])
            self.assertIn("issues/README.md", snapshot["files"])
            self.assertEqual(snapshot["recent_actions"], [])

    def test_repository_memory_records_and_searches_issues(self) -> None:
        with tempfile.TemporaryDirectory() as root_dir:
            memory = RepositoryMemory(Path(root_dir) / "memory")
            memory.append_issue(
                issue_id="LOOP-ISSUE-TEST",
                project="loop-engineering",
                severity="high",
                status="open",
                situation="CI exposed an issue.",
                symptom="Remote check failed.",
                cause="Path was not portable.",
                impact="Merge gate blocked.",
                action_taken="Recorded issue.",
                next_step="Add regression test.",
                related_task_id="TASK-TEST",
                related_pr="https://example.com/pr/1",
                related_check="Loop runtime tests",
                regression_test="python3 -m unittest discover -s tests -v",
            )
            issues = memory.search_issues(status="open", severity="high", project="loop-engineering")
            snapshot = memory.read_required_context()

            self.assertEqual(issues[-1]["issue_id"], "LOOP-ISSUE-TEST")
            self.assertEqual(issues[-1]["cause"], "Path was not portable.")
            self.assertTrue(snapshot["recent_issues"])

    def test_runtime_loads_repository_memory_and_records_actions(self) -> None:
        repo_root = Path(__file__).resolve().parents[1]
        with tempfile.TemporaryDirectory() as records_dir, tempfile.TemporaryDirectory() as worktrees_dir, tempfile.TemporaryDirectory() as repo_dir:
            payload = BootPayload(
                task_id="TASK-TEST-REPOSITORY-MEMORY",
                goal="Use repository memory before execution.",
                scope={"include": [str(repo_dir)]},
                acceptance=["Reach completed state."],
                environment={
                    "source_path": str(repo_dir),
                    "repository_root": str(repo_dir),
                    "repository_memory_path": "memory",
                    "worktree_root": worktrees_dir,
                    "available_connectors": ["filesystem"],
                },
                policy={
                    "workflow": "durable_workflow",
                    "retry_limit": 1,
                    "reviewer_required": True,
                    "verifier_required": True,
                    "allow_subagents": False,
                },
                memory={"record_path": records_dir, "memory_namespace": "repository-memory-namespace"},
            )
            runtime, task_store, memory_store = boot_runtime(
                payload=payload,
                skill_registry_path=str(repo_root / "loop_registry" / "skills.json"),
                connector_registry_path=str(repo_root / "loop_registry" / "connectors.json"),
            )
            runtime.run_until_terminal()
            task_store.save(runtime.context.task_record)
            memory_store.save(runtime.context.memory)

            action_log = Path(repo_dir) / "memory" / "action_log.jsonl"
            success_log = Path(repo_dir) / "memory" / "experience" / "successes.jsonl"
            status_file = Path(repo_dir) / "memory" / "current_status.json"
            run_file = Path(repo_dir) / "memory" / "runs" / f"{payload.task_id}.json"
            rows = [json.loads(line) for line in action_log.read_text(encoding="utf-8").splitlines()]
            successes = [json.loads(line) for line in success_log.read_text(encoding="utf-8").splitlines()]
            status = json.loads(status_file.read_text(encoding="utf-8"))
            artifact_types = {artifact["type"] for artifact in runtime.context.task_record.artifacts}

            self.assertGreaterEqual(len(rows), 1)
            self.assertIn("repository_memory_context", artifact_types)
            self.assertEqual(runtime.context.memory.project_memory["repository_memory"]["root"], str(Path(repo_dir) / "memory"))
            self.assertTrue(successes)
            self.assertEqual(status["active_task_id"], payload.task_id)
            self.assertEqual(status["status"], "completed")
            self.assertTrue(run_file.exists())
            self.assertTrue(RepositoryMemory(Path(repo_dir) / "memory").search_actions(task_id=payload.task_id))

    def test_runtime_records_intent_debt_in_repository_memory(self) -> None:
        repo_root = Path(__file__).resolve().parents[1]
        with tempfile.TemporaryDirectory() as records_dir, tempfile.TemporaryDirectory() as worktrees_dir, tempfile.TemporaryDirectory() as repo_dir:
            payload = BootPayload(
                task_id="TASK-TEST-REPOSITORY-INTENT-DEBT",
                goal="Record blocked intent debt.",
                scope={"include": [str(repo_dir)]},
                acceptance=["Block when permission is missing."],
                environment={
                    "source_path": str(repo_dir),
                    "repository_root": str(repo_dir),
                    "repository_memory_path": "memory",
                    "worktree_root": worktrees_dir,
                    "available_connectors": ["filesystem"],
                    "simulation": {"failure_type": "permission_error"},
                },
                policy={
                    "workflow": "durable_workflow",
                    "retry_limit": 1,
                    "reviewer_required": True,
                    "verifier_required": True,
                    "allow_subagents": False,
                },
                memory={"record_path": records_dir, "memory_namespace": "repository-intent-debt-namespace"},
            )
            runtime, task_store, memory_store = boot_runtime(
                payload=payload,
                skill_registry_path=str(repo_root / "loop_registry" / "skills.json"),
                connector_registry_path=str(repo_root / "loop_registry" / "connectors.json"),
            )
            runtime.run_until_terminal()
            task_store.save(runtime.context.task_record)
            memory_store.save(runtime.context.memory)

            intent_debt_log = Path(repo_dir) / "memory" / "intent_debt.jsonl"
            regression_log = Path(repo_dir) / "memory" / "regression_candidates.jsonl"
            debts = [json.loads(line) for line in intent_debt_log.read_text(encoding="utf-8").splitlines()]
            regression_candidates = [json.loads(line) for line in regression_log.read_text(encoding="utf-8").splitlines()]
            status = json.loads((Path(repo_dir) / "memory" / "current_status.json").read_text(encoding="utf-8"))

            self.assertEqual(runtime.context.task_record.status, "blocked")
            self.assertTrue(debts)
            self.assertTrue(regression_candidates)
            self.assertEqual(debts[-1]["task_id"], payload.task_id)
            self.assertEqual(regression_candidates[-1]["task_id"], payload.task_id)
            self.assertEqual(regression_candidates[-1]["failure_type"], "permission_error")
            self.assertEqual(status["status"], "blocked")
            self.assertIsNotNone(status["intent_debt"])

    def test_cli_prints_repository_memory_report(self) -> None:
        repo_root = Path(__file__).resolve().parents[1]
        with tempfile.TemporaryDirectory() as root_dir:
            boot_path = Path(root_dir) / "boot.json"
            boot_path.write_text(
                json.dumps(
                    {
                        "task_id": "TASK-TEST-MEMORY-REPORT",
                        "goal": "Report repository memory.",
                        "scope": {"include": [root_dir]},
                        "acceptance": ["Report memory."],
                        "environment": {
                            "source_path": root_dir,
                            "repository_root": root_dir,
                            "repository_memory_path": "memory",
                            "worktree_root": str(Path(root_dir) / "worktrees"),
                        },
                        "policy": {"workflow": "durable_workflow"},
                        "memory": {
                            "record_path": str(Path(root_dir) / "records"),
                            "memory_namespace": "memory-report-namespace",
                        },
                    }
                ),
                encoding="utf-8",
            )
            completed = subprocess.run(
                [
                    "python3",
                    "-m",
                    "loop_engineering.cli",
                    "--boot",
                    str(boot_path),
                    "--skills",
                    str(repo_root / "loop_registry" / "skills.json"),
                    "--connectors",
                    str(repo_root / "loop_registry" / "connectors.json"),
                    "--memory-report",
                ],
                cwd=str(repo_root),
                capture_output=True,
                text=True,
                check=False,
            )
            self.assertEqual(completed.returncode, 0, completed.stderr)
            report = json.loads(completed.stdout)
            self.assertEqual(report["status"], "available")
            self.assertIn("project_standards.md", report["loaded_files"])
            self.assertIn("recent_issues", report)
            self.assertIn("recent_regression_candidates", report)

    def test_cli_records_and_reports_issues(self) -> None:
        repo_root = Path(__file__).resolve().parents[1]
        with tempfile.TemporaryDirectory() as root_dir:
            boot_path = Path(root_dir) / "boot.json"
            boot_payload = {
                "task_id": "TASK-TEST-ISSUE-CLI",
                "goal": "Record issue.",
                "scope": {"include": [root_dir]},
                "acceptance": ["Record issue."],
                "environment": {
                    "source_path": root_dir,
                    "repository_root": root_dir,
                    "repository_memory_path": "memory",
                    "worktree_root": str(Path(root_dir) / "worktrees"),
                },
                "policy": {"workflow": "durable_workflow"},
                "memory": {
                    "record_path": str(Path(root_dir) / "records"),
                    "memory_namespace": "issue-cli-namespace",
                },
            }
            boot_path.write_text(json.dumps(boot_payload), encoding="utf-8")
            record = subprocess.run(
                [
                    "python3",
                    "-m",
                    "loop_engineering.cli",
                    "--boot",
                    str(boot_path),
                    "--skills",
                    str(repo_root / "loop_registry" / "skills.json"),
                    "--connectors",
                    str(repo_root / "loop_registry" / "connectors.json"),
                    "--record-issue",
                    "--issue-id",
                    "LOOP-ISSUE-CLI",
                    "--issue-situation",
                    "Test situation",
                    "--issue-symptom",
                    "Test symptom",
                    "--issue-cause",
                    "Test cause",
                    "--issue-impact",
                    "Test impact",
                    "--issue-action",
                    "Test action",
                    "--issue-next-step",
                    "Test next step",
                ],
                cwd=str(repo_root),
                capture_output=True,
                text=True,
                check=False,
            )
            self.assertEqual(record.returncode, 0, record.stderr)
            report = subprocess.run(
                [
                    "python3",
                    "-m",
                    "loop_engineering.cli",
                    "--boot",
                    str(boot_path),
                    "--skills",
                    str(repo_root / "loop_registry" / "skills.json"),
                    "--connectors",
                    str(repo_root / "loop_registry" / "connectors.json"),
                    "--issues-report",
                ],
                cwd=str(repo_root),
                capture_output=True,
                text=True,
                check=False,
            )
            self.assertEqual(report.returncode, 0, report.stderr)
            payload = json.loads(report.stdout)
            self.assertEqual(payload["issues"][-1]["issue_id"], "LOOP-ISSUE-CLI")


if __name__ == "__main__":
    unittest.main()
