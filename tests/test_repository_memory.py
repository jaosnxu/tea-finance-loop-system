import json
import subprocess
import tempfile
import unittest
from pathlib import Path

from loop_engineering.boot import boot_runtime
from loop_engineering.models import BootPayload
from loop_engineering.project_memory_index import load_project_memory_index
from loop_engineering.repository_memory import RepositoryMemory


class RepositoryMemoryTests(unittest.TestCase):
    def test_project_memory_index_loads_required_files_and_recent_logs(self) -> None:
        with tempfile.TemporaryDirectory() as repo_dir:
            root = Path(repo_dir)
            (root / "docs" / "loop").mkdir(parents=True)
            (root / "docs" / "dev-log").mkdir(parents=True)
            (root / "README.md").write_text("# Readme\n", encoding="utf-8")
            (root / "PROJECT_INTAKE.md").write_text("# Intake\n", encoding="utf-8")
            (root / "docs" / "PROJECT_CONSTITUTION.md").write_text("# Constitution\n", encoding="utf-8")
            for index in range(1, 5):
                (root / "docs" / "dev-log" / f"DEV-00{index}.md").write_text(f"# DEV {index}\n", encoding="utf-8")
            (root / "docs" / "loop" / "00_MEMORY_INDEX.md").write_text(
                "\n".join(
                    [
                        "# Loop Memory Index",
                        "1. `README.md`",
                        "- `PROJECT_INTAKE.md`",
                        "3. `docs/PROJECT_CONSTITUTION.md`",
                        "4. 最近 3 个 `docs/dev-log/DEV-*.md`",
                    ]
                ),
                encoding="utf-8",
            )

            snapshot = load_project_memory_index(root)

            self.assertEqual(snapshot["status"], "available")
            self.assertIn("docs/loop/00_MEMORY_INDEX.md", snapshot["files"])
            self.assertIn("PROJECT_INTAKE.md", snapshot["files"])
            self.assertIn("docs/PROJECT_CONSTITUTION.md", snapshot["files"])
            self.assertNotIn("docs/dev-log/DEV-001.md", snapshot["files"])
            self.assertIn("docs/dev-log/DEV-002.md", snapshot["files"])
            self.assertIn("docs/dev-log/DEV-004.md", snapshot["files"])
            self.assertEqual(snapshot["missing_files"], [])

    def test_project_memory_index_rejects_paths_outside_project_root(self) -> None:
        with tempfile.TemporaryDirectory() as parent_dir:
            parent = Path(parent_dir)
            root = parent / "project"
            root.mkdir()
            (root / "docs" / "loop").mkdir(parents=True)
            (root / "README.md").write_text("# Readme\n", encoding="utf-8")
            (parent / "secret.md").write_text("# Secret\n", encoding="utf-8")
            (root / "docs" / "loop" / "00_MEMORY_INDEX.md").write_text(
                "\n".join(
                    [
                        "# Loop Memory Index",
                        "1. `README.md`",
                        "2. `../secret.md`",
                        "3. `../*.md`",
                        f"4. `{parent / 'secret.md'}`",
                    ]
                ),
                encoding="utf-8",
            )

            snapshot = load_project_memory_index(root)

            self.assertEqual(snapshot["status"], "available")
            self.assertIn("README.md", snapshot["files"])
            self.assertNotIn("../secret.md", snapshot["files"])
            self.assertNotIn("secret.md", snapshot["files"])
            self.assertIn("../secret.md", snapshot["rejected_files"])
            self.assertIn("../*.md", snapshot["rejected_files"])
            self.assertIn(str(parent / "secret.md"), snapshot["rejected_files"])

    def test_repository_memory_initializes_required_files(self) -> None:
        with tempfile.TemporaryDirectory() as root_dir:
            memory = RepositoryMemory(Path(root_dir) / "memory")
            snapshot = memory.read_required_context()

            self.assertTrue((Path(root_dir) / "memory" / "README.md").exists())
            self.assertTrue((Path(root_dir) / "memory" / "projects" / "tea-finance-system.md").exists())
            self.assertTrue((Path(root_dir) / "memory" / "experience" / "successes.jsonl").exists())
            self.assertTrue((Path(root_dir) / "memory" / "intent_debt.jsonl").exists())
            self.assertTrue((Path(root_dir) / "memory" / "regression_candidates.jsonl").exists())
            self.assertTrue((Path(root_dir) / "memory" / "current_status.json").exists())
            self.assertIn("project_standards.md", snapshot["files"])
            self.assertIn("verification/regression_policy.md", snapshot["files"])
            self.assertIn("backlog/loop-engineering.json", snapshot["files"])
            self.assertEqual(snapshot["recent_actions"], [])

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
            self.assertIn("project_memory_index_context", artifact_types)
            self.assertEqual(runtime.context.memory.project_memory["repository_memory"]["root"], str(Path(repo_dir) / "memory"))
            self.assertTrue(successes)
            self.assertEqual(status["active_task_id"], payload.task_id)
            self.assertEqual(status["status"], "completed")
            self.assertTrue(run_file.exists())
            self.assertTrue(RepositoryMemory(Path(repo_dir) / "memory").search_actions(task_id=payload.task_id))

    def test_runtime_loads_project_memory_index_from_target_repository(self) -> None:
        repo_root = Path(__file__).resolve().parents[1]
        with tempfile.TemporaryDirectory() as records_dir, tempfile.TemporaryDirectory() as worktrees_dir, tempfile.TemporaryDirectory() as repo_dir:
            project_root = Path(repo_dir)
            (project_root / "docs" / "loop").mkdir(parents=True)
            (project_root / "README.md").write_text("# Project\n", encoding="utf-8")
            (project_root / "PROJECT_INTAKE.md").write_text("# Intake\n", encoding="utf-8")
            (project_root / "docs" / "PROJECT_CONSTITUTION.md").write_text("# Constitution\n", encoding="utf-8")
            (project_root / "docs" / "loop" / "00_MEMORY_INDEX.md").write_text(
                "\n".join(
                    [
                        "# Loop Memory Index",
                        "1. `README.md`",
                        "2. `PROJECT_INTAKE.md`",
                        "3. `docs/PROJECT_CONSTITUTION.md`",
                    ]
                ),
                encoding="utf-8",
            )
            payload = BootPayload(
                task_id="TASK-TEST-PROJECT-MEMORY-INDEX",
                goal="Load target project memory index before planning.",
                scope={"include": [str(project_root)]},
                acceptance=["Project memory index is loaded."],
                environment={
                    "source_path": str(project_root),
                    "project_root": str(project_root),
                    "require_project_memory_index": True,
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
                memory={"record_path": records_dir, "memory_namespace": "project-memory-index-namespace"},
            )
            runtime, task_store, memory_store = boot_runtime(
                payload=payload,
                skill_registry_path=str(repo_root / "loop_registry" / "skills.json"),
                connector_registry_path=str(repo_root / "loop_registry" / "connectors.json"),
            )
            runtime.run_until_terminal()
            task_store.save(runtime.context.task_record)
            memory_store.save(runtime.context.memory)

            project_memory = runtime.context.memory.project_memory["project_memory_index"]
            self.assertEqual(project_memory["status"], "available")
            self.assertIn("docs/PROJECT_CONSTITUTION.md", project_memory["loaded_files"])
            artifact_types = {artifact["type"] for artifact in runtime.context.task_record.artifacts}
            self.assertIn("project_memory_index_context", artifact_types)

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
            self.assertIn("recent_regression_candidates", report)


if __name__ == "__main__":
    unittest.main()
