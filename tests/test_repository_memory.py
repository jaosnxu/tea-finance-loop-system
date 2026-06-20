import json
import subprocess
import tempfile
import unittest
from pathlib import Path

from loop_engineering.boot import boot_runtime
from loop_engineering.models import BootPayload
from loop_engineering.project_memory_index import load_project_memory_index
from loop_engineering.repair_scheduler import plan_repair_queue, requeue_stale_claims
from loop_engineering.repository_memory import RepositoryMemory
from loop_engineering.trace_summary import summarize_trace


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
            self.assertTrue((Path(root_dir) / "memory" / "projects" / "default-project.md").exists())
            self.assertFalse((Path(root_dir) / "memory" / "projects" / "tea-finance-system.md").exists())
            self.assertFalse((Path(root_dir) / "memory" / "projects" / "loop-engineering.md").exists())
            self.assertTrue((Path(root_dir) / "memory" / "experience" / "successes.jsonl").exists())
            self.assertTrue((Path(root_dir) / "memory" / "intent_debt.jsonl").exists())
            self.assertTrue((Path(root_dir) / "memory" / "issues" / "loop-system-issues.jsonl").exists())
            self.assertTrue((Path(root_dir) / "memory" / "repair_queue.jsonl").exists())
            self.assertTrue((Path(root_dir) / "memory" / "approval_requests.jsonl").exists())
            self.assertTrue((Path(root_dir) / "memory" / "regression_candidates.jsonl").exists())
            self.assertTrue((Path(root_dir) / "memory" / "run_history.jsonl").exists())
            self.assertTrue((Path(root_dir) / "memory" / "current_status.json").exists())
            self.assertIn("project_standards.md", snapshot["files"])
            self.assertIn("verification/regression_policy.md", snapshot["files"])
            self.assertIn("issues/README.md", snapshot["files"])
            self.assertIn("backlog/default-project.json", snapshot["files"])
            self.assertNotIn("backlog/tea-finance-system.json", snapshot["files"])
            self.assertNotIn("backlog/loop-engineering.json", snapshot["files"])
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
            run_history_file = Path(repo_dir) / "memory" / "run_history.jsonl"
            rows = [json.loads(line) for line in action_log.read_text(encoding="utf-8").splitlines()]
            successes = [json.loads(line) for line in success_log.read_text(encoding="utf-8").splitlines()]
            status = json.loads(status_file.read_text(encoding="utf-8"))
            run_summary = json.loads(run_file.read_text(encoding="utf-8"))
            run_history = [json.loads(line) for line in run_history_file.read_text(encoding="utf-8").splitlines()]
            artifact_types = {artifact["type"] for artifact in runtime.context.task_record.artifacts}

            self.assertGreaterEqual(len(rows), 1)
            self.assertIn("repository_memory_context", artifact_types)
            self.assertIn("project_memory_index_context", artifact_types)
            self.assertEqual(runtime.context.memory.project_memory["repository_memory"]["root"], str(Path(repo_dir) / "memory"))
            self.assertTrue(successes)
            self.assertEqual(status["active_task_id"], payload.task_id)
            self.assertEqual(status["status"], "completed")
            self.assertTrue(run_file.exists())
            self.assertEqual(run_summary["schema_version"], "loop.run_summary.v1")
            self.assertEqual(run_summary["status"], "completed")
            self.assertEqual(run_history[-1]["task_id"], payload.task_id)
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

    def test_exhausted_self_repair_enters_repository_repair_queue(self) -> None:
        repo_root = Path(__file__).resolve().parents[1]
        with tempfile.TemporaryDirectory() as records_dir, tempfile.TemporaryDirectory() as worktrees_dir, tempfile.TemporaryDirectory() as repo_dir:
            payload = BootPayload(
                task_id="TASK-TEST-REPAIR-QUEUE",
                goal="Queue exhausted code repair.",
                scope={"include": [str(repo_dir)]},
                acceptance=["Queue repair after code failure budget is exhausted."],
                environment={
                    "source_path": str(repo_dir),
                    "repository_root": str(repo_dir),
                    "repository_memory_path": "memory",
                    "worktree_root": worktrees_dir,
                    "available_connectors": ["filesystem"],
                    "simulation": {"failure_type": "code_error"},
                },
                policy={
                    "workflow": "durable_workflow",
                    "retry_limit": 1,
                    "self_repair_limit": 0,
                    "reviewer_required": True,
                    "verifier_required": True,
                    "allow_subagents": False,
                },
                memory={"record_path": records_dir, "memory_namespace": "repair-queue-namespace"},
            )
            runtime, task_store, memory_store = boot_runtime(
                payload=payload,
                skill_registry_path=str(repo_root / "loop_registry" / "skills.json"),
                connector_registry_path=str(repo_root / "loop_registry" / "connectors.json"),
            )
            runtime.run_until_terminal(max_steps=8)
            task_store.save(runtime.context.task_record)
            memory_store.save(runtime.context.memory)

            repair_queue_path = Path(repo_dir) / "memory" / "repair_queue.jsonl"
            queue_rows = [json.loads(line) for line in repair_queue_path.read_text(encoding="utf-8").splitlines()]
            summary = json.loads((Path(records_dir) / payload.task_id / "run_summary.json").read_text(encoding="utf-8"))
            repository_snapshot = RepositoryMemory(Path(repo_dir) / "memory").read_required_context()

            self.assertEqual(runtime.context.task_record.status, "blocked")
            self.assertEqual(queue_rows[-1]["source_task_id"], payload.task_id)
            self.assertEqual(queue_rows[-1]["queue_class"], "automated_repair")
            self.assertEqual(queue_rows[-1]["resume_strategy"], "split_scope_reroute_tools_and_restart_from_planning")
            self.assertTrue(summary["repair_queue"]["queued"])
            self.assertEqual(repository_snapshot["recent_repair_queue"][-1]["source_task_id"], payload.task_id)

    def test_preflight_auth_block_enters_repository_repair_queue(self) -> None:
        repo_root = Path(__file__).resolve().parents[1]
        with tempfile.TemporaryDirectory() as records_dir, tempfile.TemporaryDirectory() as worktrees_dir, tempfile.TemporaryDirectory() as repo_dir:
            payload = BootPayload(
                task_id="TASK-TEST-AUTH-REPAIR-QUEUE",
                goal="Queue missing auth preflight blocker.",
                scope={"include": [str(repo_dir)]},
                acceptance=["Queue auth blockers after preflight failure."],
                environment={
                    "source_path": str(repo_dir),
                    "repository_root": str(repo_dir),
                    "repository_memory_path": "memory",
                    "worktree_root": worktrees_dir,
                    "available_connectors": ["github"],
                },
                policy={
                    "workflow": "durable_workflow",
                    "enforce_connector_auth": True,
                    "reviewer_required": True,
                    "verifier_required": True,
                    "allow_subagents": False,
                },
                memory={"record_path": records_dir, "memory_namespace": "auth-queue-namespace"},
            )
            runtime, task_store, memory_store = boot_runtime(
                payload=payload,
                skill_registry_path=str(repo_root / "loop_registry" / "skills.json"),
                connector_registry_path=str(repo_root / "loop_registry" / "connectors.json"),
            )
            runtime.run_until_terminal(max_steps=8)
            task_store.save(runtime.context.task_record)
            memory_store.save(runtime.context.memory)

            intent_debt_path = Path(repo_dir) / "memory" / "intent_debt.jsonl"
            repair_queue_path = Path(repo_dir) / "memory" / "repair_queue.jsonl"
            debt_rows = [json.loads(line) for line in intent_debt_path.read_text(encoding="utf-8").splitlines()]
            queue_rows = [json.loads(line) for line in repair_queue_path.read_text(encoding="utf-8").splitlines()]

            self.assertEqual(runtime.context.task_record.status, "blocked")
            self.assertEqual(debt_rows[-1]["debt"]["failure_type"], "auth_error")
            self.assertEqual(queue_rows[-1]["source_task_id"], payload.task_id)
            self.assertEqual(queue_rows[-1]["queue_class"], "human_blocked")
            self.assertEqual(queue_rows[-1]["resume_strategy"], "resume_after_permission_or_auth_is_restored")

    def test_repair_queue_classifies_delayed_retry_and_production_approval(self) -> None:
        with tempfile.TemporaryDirectory() as repo_dir:
            memory = RepositoryMemory(Path(repo_dir) / "memory")
            memory.initialize()
            memory.enqueue_repair(
                task_id="TASK-NETWORK",
                goal="Retry transient network failure.",
                failure_type="network_error",
                reason="network exhausted retries",
                next_step="enqueue delayed retry with backoff and previous failure history",
                repair_count=0,
                retry_count=3,
            )
            memory.enqueue_repair(
                task_id="TASK-PRODUCTION",
                goal="Block production risk.",
                failure_type="production_risk",
                reason="production approval missing",
                next_step="require explicit production approval before resuming",
                repair_count=0,
                retry_count=0,
            )
            queue_rows = [
                json.loads(line)
                for line in (Path(repo_dir) / "memory" / "repair_queue.jsonl").read_text(encoding="utf-8").splitlines()
            ]

            self.assertEqual(queue_rows[0]["queue_class"], "delayed_retry")
            self.assertEqual(queue_rows[0]["resume_strategy"], "resume_after_backoff_with_previous_failure_history")
            self.assertEqual(queue_rows[1]["queue_class"], "approval_required")
            self.assertEqual(queue_rows[1]["resume_strategy"], "resume_only_after_explicit_production_approval")

    def test_repair_queue_can_be_claimed_and_finished(self) -> None:
        with tempfile.TemporaryDirectory() as repo_dir:
            memory = RepositoryMemory(Path(repo_dir) / "memory")
            memory.initialize()
            memory.enqueue_repair(
                task_id="TASK-OLD",
                goal="Repair old task.",
                failure_type="code_error",
                reason="self-repair exhausted",
                next_step="split scope and restart",
                repair_count=3,
                retry_count=0,
            )

            claimed = memory.claim_repair_item(source_task_id="TASK-OLD", worker_task_id="TASK-WORKER")
            open_items = memory.list_repair_items(status="open")
            claimed_items = memory.list_repair_items(status="claimed")
            finished = memory.finish_repair_item(
                source_task_id="TASK-OLD",
                worker_task_id="TASK-WORKER",
                status="resolved",
                summary="Worker completed repair.",
            )
            resolved_items = memory.list_repair_items(status="resolved")

            self.assertIsNotNone(claimed)
            self.assertEqual(open_items, [])
            self.assertEqual(claimed_items[-1]["claimed_by_task_id"], "TASK-WORKER")
            self.assertIsNotNone(finished)
            self.assertEqual(resolved_items[-1]["source_task_id"], "TASK-OLD")
            self.assertEqual(resolved_items[-1]["finished_by_task_id"], "TASK-WORKER")

    def test_repair_scheduler_splits_claimable_blocked_and_stale_items(self) -> None:
        with tempfile.TemporaryDirectory() as repo_dir:
            memory = RepositoryMemory(Path(repo_dir) / "memory")
            memory.initialize()
            memory.enqueue_repair(
                task_id="TASK-AUTO",
                goal="Auto repair.",
                failure_type="code_error",
                reason="self-repair exhausted",
                next_step="restart",
                repair_count=3,
                retry_count=0,
            )
            memory.enqueue_repair(
                task_id="TASK-AUTH",
                goal="Auth blocked.",
                failure_type="auth_error",
                reason="auth missing",
                next_step="wait for auth",
                repair_count=0,
                retry_count=0,
            )

            plan = plan_repair_queue(memory)

            self.assertEqual(plan["status"], "ready")
            self.assertEqual(plan["claimable_count"], 1)
            self.assertEqual(plan["blocked_count"], 1)
            self.assertEqual(plan["triage_count"], 0)

    def test_repair_scheduler_surfaces_triage_only_items(self) -> None:
        with tempfile.TemporaryDirectory() as repo_dir:
            memory = RepositoryMemory(Path(repo_dir) / "memory")
            memory.initialize()
            memory.enqueue_repair(
                task_id="TASK-UNKNOWN",
                goal="Unknown failure.",
                failure_type="unknown",
                reason="verification failed without classification",
                next_step="triage failure and assign queue class",
                repair_count=0,
                retry_count=0,
            )

            plan = plan_repair_queue(memory)

            self.assertEqual(plan["status"], "attention_required")
            self.assertEqual(plan["claimable_count"], 0)
            self.assertEqual(plan["blocked_count"], 0)
            self.assertEqual(plan["triage_count"], 1)
            self.assertEqual(plan["triage"][0]["source_task_id"], "TASK-UNKNOWN")
            self.assertIn("triage unknown failure repair items", " ".join(plan["next_actions"]))

    def test_repair_scheduler_requeues_stale_claims(self) -> None:
        with tempfile.TemporaryDirectory() as repo_dir:
            memory = RepositoryMemory(Path(repo_dir) / "memory")
            memory.enqueue_repair(
                task_id="TASK-STALE",
                goal="Repair stale claim.",
                failure_type="code_error",
                reason="self-repair exhausted",
                next_step="restart",
                repair_count=3,
                retry_count=0,
            )
            self.assertIsNotNone(memory.claim_repair_item(source_task_id="TASK-STALE", worker_task_id="TASK-WORKER"))

            result = requeue_stale_claims(memory, stale_claim_minutes=-1)

            self.assertEqual(result["requeued_count"], 1)
            self.assertEqual(memory.list_repair_items(status="open")[-1]["source_task_id"], "TASK-STALE")

    def test_approval_requests_can_be_created_and_resolved(self) -> None:
        with tempfile.TemporaryDirectory() as repo_dir:
            memory = RepositoryMemory(Path(repo_dir) / "memory")
            request = memory.create_approval_request(
                task_id="TASK-APPROVAL",
                approval_type="tool_policy",
                subject="github",
                reason="high-risk connector requires approval",
                risk_level="high",
            )
            resolved = memory.resolve_approval_request(
                approval_id=request["approval_id"],
                status="approved",
                resolved_by="owner",
                resolution_note="approved for test",
            )

            self.assertEqual(memory.list_approval_requests(status="open"), [])
            self.assertIsNotNone(resolved)
            self.assertEqual(memory.list_approval_requests(status="approved")[-1]["resolved_by"], "owner")

    def test_regression_manifest_builds_recommended_tests(self) -> None:
        with tempfile.TemporaryDirectory() as repo_dir:
            memory = RepositoryMemory(Path(repo_dir) / "memory")
            memory.append_regression_candidate(
                task_id="TASK-REGRESSION",
                failure_type="code_error",
                stage="verifying",
                summary="Eval failed.",
                reproduction="Run task through verifying.",
                expected_behavior="Eval passes.",
            )

            manifest = memory.build_regression_manifest()

            self.assertEqual(manifest["candidate_count"], 1)
            self.assertEqual(manifest["recommended_tests"][0]["task_id"], "TASK-REGRESSION")
            self.assertIn("regression_task-regression_code_error", manifest["recommended_tests"][0]["name"])

    def test_trace_summary_counts_events_and_terminal_state(self) -> None:
        summary = summarize_trace(
            [
                {"event_type": "heartbeat", "payload": {"stage": "intake"}},
                {"event_type": "stage_started", "payload": {"stage": "intake"}},
                {"event_type": "stage_finished", "payload": {"next_state": "completed"}},
            ]
        )

        self.assertEqual(summary["event_count"], 3)
        self.assertTrue(summary["has_heartbeat"])
        self.assertTrue(summary["has_terminal_event"])
        self.assertEqual(summary["stage_sequence"], ["intake"])

    def test_boot_auto_resumes_claimable_repair_queue_item(self) -> None:
        repo_root = Path(__file__).resolve().parents[1]
        with tempfile.TemporaryDirectory() as records_dir, tempfile.TemporaryDirectory() as worktrees_dir, tempfile.TemporaryDirectory() as repo_dir:
            memory = RepositoryMemory(Path(repo_dir) / "memory")
            memory.initialize()
            memory.enqueue_repair(
                task_id="TASK-OLD-CODE-FAILURE",
                goal="Repair old code failure.",
                failure_type="code_error",
                reason="self-repair exhausted",
                next_step="split scope and restart",
                repair_count=3,
                retry_count=0,
            )
            payload = BootPayload(
                task_id="TASK-QUEUE-WORKER",
                goal="Resume repair queue.",
                scope={"include": [str(repo_dir)]},
                acceptance=["Claim and resolve a repair queue item."],
                environment={
                    "source_path": str(repo_dir),
                    "repository_root": str(repo_dir),
                    "repository_memory_path": "memory",
                    "worktree_root": worktrees_dir,
                    "available_connectors": ["filesystem"],
                },
                policy={
                    "workflow": "durable_workflow",
                    "auto_resume_repair_queue": True,
                    "retry_limit": 1,
                    "reviewer_required": True,
                    "verifier_required": True,
                    "allow_subagents": False,
                },
                memory={"record_path": records_dir, "memory_namespace": "repair-queue-resume-namespace"},
            )
            runtime, task_store, memory_store = boot_runtime(
                payload=payload,
                skill_registry_path=str(repo_root / "loop_registry" / "skills.json"),
                connector_registry_path=str(repo_root / "loop_registry" / "connectors.json"),
            )
            runtime.run_until_terminal(max_steps=8)
            task_store.save(runtime.context.task_record)
            memory_store.save(runtime.context.memory)

            resolved_items = RepositoryMemory(Path(repo_dir) / "memory").list_repair_items(status="resolved")
            artifact_types = {artifact["type"] for artifact in runtime.context.task_record.artifacts}

            self.assertEqual(runtime.context.task_record.status, "completed")
            self.assertEqual(resolved_items[-1]["source_task_id"], "TASK-OLD-CODE-FAILURE")
            self.assertEqual(resolved_items[-1]["finished_by_task_id"], payload.task_id)
            self.assertIn("repair_queue_resume", artifact_types)
            self.assertIn("repair_queue_finish", artifact_types)

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

            self.assertEqual(record.returncode, 0, record.stderr)
            self.assertEqual(report.returncode, 0, report.stderr)
            payload = json.loads(report.stdout)
            self.assertEqual(payload["issues"][-1]["issue_id"], "LOOP-ISSUE-CLI")

    def test_cli_reports_regression_manifest_and_resolves_approval(self) -> None:
        repo_root = Path(__file__).resolve().parents[1]
        with tempfile.TemporaryDirectory() as root_dir:
            memory = RepositoryMemory(Path(root_dir) / "memory")
            request = memory.create_approval_request(
                task_id="TASK-CLI-APPROVAL",
                approval_type="tool_policy",
                subject="github",
                reason="approval required",
                risk_level="high",
            )
            memory.append_regression_candidate(
                task_id="TASK-CLI-REGRESSION",
                failure_type="code_error",
                stage="verifying",
                summary="Regression candidate.",
                reproduction="Run CLI task.",
                expected_behavior="No failure.",
            )
            boot_path = Path(root_dir) / "boot.json"
            boot_path.write_text(
                json.dumps(
                    {
                        "task_id": "TASK-TEST-CLI-CONTROL",
                        "goal": "Report CLI control plane.",
                        "scope": {"include": [root_dir]},
                        "acceptance": ["Report control plane."],
                        "environment": {
                            "source_path": root_dir,
                            "repository_root": root_dir,
                            "repository_memory_path": "memory",
                            "worktree_root": str(Path(root_dir) / "worktrees"),
                        },
                        "policy": {"workflow": "durable_workflow"},
                        "memory": {
                            "record_path": str(Path(root_dir) / "records"),
                            "memory_namespace": "cli-control-namespace",
                        },
                    }
                ),
                encoding="utf-8",
            )
            manifest = subprocess.run(
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
                    "--regression-manifest",
                ],
                cwd=str(repo_root),
                capture_output=True,
                text=True,
                check=False,
            )
            approval = subprocess.run(
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
                    "--approve-id",
                    request["approval_id"],
                    "--resolved-by",
                    "tester",
                ],
                cwd=str(repo_root),
                capture_output=True,
                text=True,
                check=False,
            )

            self.assertEqual(manifest.returncode, 0, manifest.stderr)
            self.assertEqual(json.loads(manifest.stdout)["candidate_count"], 1)
            self.assertEqual(approval.returncode, 0, approval.stderr)
            self.assertEqual(json.loads(approval.stdout)["approval_request"]["status"], "approved")


if __name__ == "__main__":
    unittest.main()
