import json
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
            self.assertIn("project_standards.md", snapshot["files"])
            self.assertEqual(snapshot["recent_actions"], [])

    def test_runtime_loads_repository_memory_and_records_actions(self) -> None:
        repo_root = Path("/Users/jason/Documents/Codex/2026-06-13-new-chat")
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
            rows = [json.loads(line) for line in action_log.read_text(encoding="utf-8").splitlines()]
            successes = [json.loads(line) for line in success_log.read_text(encoding="utf-8").splitlines()]
            artifact_types = {artifact["type"] for artifact in runtime.context.task_record.artifacts}

            self.assertGreaterEqual(len(rows), 1)
            self.assertIn("repository_memory_context", artifact_types)
            self.assertEqual(runtime.context.memory.project_memory["repository_memory"]["root"], str(Path(repo_dir) / "memory"))
            self.assertTrue(successes)


if __name__ == "__main__":
    unittest.main()
