from __future__ import annotations

from dataclasses import asdict
import re

from .connector_runner import execute_connector
from .eval_harness import run_eval_cases
from .failures import BLOCKING_FAILURES, STOP_FAILURES, classify_failure, should_retry, should_self_repair
from .gates import merge_gate, review_gate, verification_gate
from .issue_planner import create_issue_backlog
from .models import RuntimeContext, RuntimeStepResult, utc_now
from .preflight import preflight_gate
from .skill_runner import execute_skill
from .workflow import workflow_manifest


STATE_ORDER = [
    "intake",
    "understanding",
    "planning",
    "routing",
    "preflight",
    "executing",
    "reviewing",
    "verifying",
]

TRIGGER_SUMMARY_STOPWORDS = {
    "a",
    "an",
    "and",
    "be",
    "do",
    "for",
    "from",
    "if",
    "in",
    "into",
    "needs",
    "not",
    "of",
    "or",
    "the",
    "this",
    "to",
    "use",
    "when",
    "with",
}


class LoopRuntime:
    def __init__(self, context: RuntimeContext, task_store, subagent_manager, memory_store=None, repository_memory_store=None) -> None:
        self.context = context
        self.task_store = task_store
        self.subagent_manager = subagent_manager
        self.memory_store = memory_store
        self.repository_memory_store = repository_memory_store

    def step(self) -> RuntimeStepResult:
        stage = self.context.task_record.current_stage
        self._heartbeat(stage)
        self._trace("stage_started", {"stage": stage})
        if stage == "intake":
            result = RuntimeStepResult(
                state=stage,
                summary="Accepted goal and initialized task context.",
                actions=[
                    {"type": "accept_goal", "goal": self.context.task_record.goal},
                    {"type": "workflow_manifest", "value": workflow_manifest()},
                ],
                next_state="understanding",
            )
        elif stage == "understanding":
            repository_memory = self.context.repository_memory
            project_memory_index = repository_memory.get("project_memory_index", {})
            result = RuntimeStepResult(
                state=stage,
                summary="Parsed task scope, acceptance, available resources, and repository memory.",
                actions=[
                    {"type": "read_scope", "scope": self.context.task_record.scope},
                    {"type": "read_acceptance", "acceptance": self.context.task_record.acceptance},
                    {
                        "type": "read_repository_memory",
                        "root": repository_memory.get("root"),
                        "loaded_files": sorted(repository_memory.get("files", {}).keys()),
                        "recent_action_count": len(repository_memory.get("recent_actions", [])),
                        "recent_intent_debt_count": len(repository_memory.get("recent_intent_debt", [])),
                        "recent_repair_queue_count": len(repository_memory.get("recent_repair_queue", [])),
                        "recent_regression_candidate_count": len(repository_memory.get("recent_regression_candidates", [])),
                        "recent_run_summary_count": len(repository_memory.get("recent_run_summaries", [])),
                        "current_status": repository_memory.get("current_status", {}),
                    },
                    {
                        "type": "read_project_memory_index",
                        "root": project_memory_index.get("root"),
                        "index_path": project_memory_index.get("index_path"),
                        "status": project_memory_index.get("status"),
                        "loaded_files": project_memory_index.get("loaded_files", []),
                        "missing_files": project_memory_index.get("missing_files", []),
                        "rejected_files": project_memory_index.get("rejected_files", []),
                    },
                ],
                artifacts=[
                    {
                        "type": "repository_memory_context",
                        "root": repository_memory.get("root"),
                        "loaded_files": sorted(repository_memory.get("files", {}).keys()),
                        "recent_action_count": len(repository_memory.get("recent_actions", [])),
                        "recent_intent_debt_count": len(repository_memory.get("recent_intent_debt", [])),
                        "recent_repair_queue_count": len(repository_memory.get("recent_repair_queue", [])),
                        "recent_regression_candidate_count": len(repository_memory.get("recent_regression_candidates", [])),
                        "recent_run_summary_count": len(repository_memory.get("recent_run_summaries", [])),
                        "recent_success_count": len(repository_memory.get("recent_successes", [])),
                        "recent_failure_count": len(repository_memory.get("recent_failures", [])),
                        "current_status": repository_memory.get("current_status", {}),
                    },
                    {
                        "type": "project_memory_index_context",
                        "root": project_memory_index.get("root"),
                        "index_path": project_memory_index.get("index_path"),
                        "status": project_memory_index.get("status"),
                        "loaded_files": project_memory_index.get("loaded_files", []),
                        "missing_files": project_memory_index.get("missing_files", []),
                        "rejected_files": project_memory_index.get("rejected_files", []),
                    }
                ],
                next_state="planning",
            )
        elif stage == "planning":
            issue_backlog = create_issue_backlog(
                self.context.task_record.goal,
                self.context.task_record.scope,
                self.context.task_record.acceptance,
            )
            self.context.task_record.issue_backlog = issue_backlog
            self.context.memory.task_memory["issue_backlog"] = issue_backlog
            planned_steps = ["create_issue_backlog", "route_skills", "route_connectors", "prepare_execution"]
            if self.context.policy.get("allow_subagents", False):
                planned_steps.append("spawn_subagent_if_needed")
            result = RuntimeStepResult(
                state=stage,
                summary="Built minimal execution plan from current goal.",
                actions=[
                    {
                        "type": "plan",
                        "steps": planned_steps,
                    }
                ],
                artifacts=[{"type": "issue_backlog", "value": issue_backlog}],
                next_state="routing",
            )
        elif stage == "routing":
            experience = self._lookup_experience("routing")
            selected_skills = self._select_skills(experience)
            selected_connectors = self._select_connectors(experience)
            self.context.memory.task_memory["selected_skills"] = selected_skills
            self.context.memory.task_memory["selected_connectors"] = selected_connectors
            self.context.memory.task_memory["experience_lookup"] = experience
            subagent_actions = []
            if self.context.policy.get("allow_subagents", False):
                subagent = self.subagent_manager.spawn(
                    goal="Inspect scoped task context and return structured finding.",
                    scope={"focus": "goal_and_scope"},
                    input_context={
                        "goal": self.context.task_record.goal,
                        "scope": self.context.task_record.scope,
                    },
                    allowed_skills=selected_skills[:1],
                    allowed_connectors=selected_connectors[:1],
                    worktree_id=self.context.primary_worktree.worktree_id,
                    success_criteria=["Return one structured finding."],
                    timebox=1,
                )
                self.context.subagents.append(subagent)
                self.context.task_record.active_subagents.append(subagent.subagent_id)
                subagent_actions.append({"type": "spawn_subagent", "subagent_id": subagent.subagent_id})
            result = RuntimeStepResult(
                state=stage,
                summary="Selected candidate skills and connectors for the task.",
                actions=[
                    {"type": "selected_skills", "skills": selected_skills},
                    {"type": "selected_connectors", "connectors": selected_connectors},
                ]
                + subagent_actions,
                next_state="preflight",
            )
        elif stage == "preflight":
            result = self._preflight()
        elif stage == "executing":
            result = self._execute()
        elif stage == "reviewing":
            result = self._review()
        elif stage == "verifying":
            result = self._verify()
        elif stage == "repairing":
            result = self._repair()
        else:
            result = RuntimeStepResult(
                state=stage,
                summary="Runtime reached terminal state.",
                next_state=None,
            )
        self._apply_result(result)
        self._trace("stage_finished", result.__dict__)
        return result

    def run_until_terminal(self, max_steps: int = 10) -> list[RuntimeStepResult]:
        results: list[RuntimeStepResult] = []
        for _ in range(max_steps):
            result = self.step()
            results.append(result)
            if self.context.task_record.status in {"completed", "blocked", "aborted"}:
                break
        return results

    def _apply_result(self, result: RuntimeStepResult) -> None:
        record = self.context.task_record
        record.attempt_count += 1
        record.updated_at = utc_now()
        record.heartbeat_at = record.updated_at
        record.current_step_status = result.status
        record.latest_report = asdict(result)
        record.artifacts.extend(result.artifacts)
        report = {
            "task_id": record.task_id,
            "stage": result.state,
            "status": result.status,
            "summary": result.summary,
            "failure_type": result.failure_type,
            "next_state": result.next_state,
            "timestamp": record.updated_at,
        }
        self.task_store.append_report(report)
        self._append_repository_action(result)
        self._trace("report_appended", report)
        self.context.memory.task_memory.update(
            {
                "task_id": record.task_id,
                "goal": record.goal,
                "current_stage": result.next_state or result.state,
                "last_action": result.actions[-1] if result.actions else None,
                "last_feedback": result.summary,
                "current_step_status": result.status,
                "updated_at": record.updated_at,
            }
        )
        if result.failure_type:
            record.failure_history.append(
                {
                    "stage": result.state,
                    "failure_type": result.failure_type,
                    "summary": result.summary,
                    "at": record.updated_at,
                }
            )
            if self.memory_store:
                self.memory_store.add_failure(
                    self.context.memory,
                    pattern=result.failure_type,
                    context={"stage": result.state, "goal": record.goal},
                    outcome=result.summary,
                    recommendation="Review repair path and update routing or policy.",
                )
            if self.repository_memory_store:
                self.repository_memory_store.append_experience(
                    kind="failure",
                    task_id=record.task_id,
                    pattern=result.failure_type,
                    summary=result.summary,
                    recommendation="Review repair path and update routing or policy.",
                )
                self.repository_memory_store.append_regression_candidate(
                    task_id=record.task_id,
                    failure_type=result.failure_type,
                    stage=result.state,
                    summary=result.summary,
                    reproduction=f"Run task {record.task_id} through stage {result.state}.",
                    expected_behavior="The same failure type should be covered by a regression test or explicit policy gate.",
                )
        if result.next_state == "completed":
            record.status = "completed"
            record.current_stage = "completed"
            self._finish_active_repair_queue_item("resolved", result.summary)
            if self.memory_store:
                self.memory_store.add_success(
                    self.context.memory,
                    pattern="task_completed",
                    context={"goal": record.goal},
                    outcome=result.summary,
                    recommendation="Reuse selected skills/connectors for similar goals.",
                )
            if self.repository_memory_store:
                self.repository_memory_store.append_experience(
                    kind="success",
                    task_id=record.task_id,
                    pattern="task_completed",
                    summary=result.summary,
                    recommendation="Reuse selected skills/connectors for similar goals.",
                )
        elif result.next_state == "blocked":
            record.status = "blocked"
            record.current_stage = "blocked"
            if self.repository_memory_store and record.intent_debt:
                self.repository_memory_store.append_intent_debt(
                    task_id=record.task_id,
                    debt=record.intent_debt,
                )
                self.repository_memory_store.enqueue_repair(
                    task_id=record.task_id,
                    goal=record.goal,
                    failure_type=str(record.intent_debt.get("failure_type") or "unknown"),
                    reason=str(record.intent_debt.get("reason") or "unknown"),
                    next_step=str(record.intent_debt.get("next_step") or "inspect failure history"),
                    repair_count=record.repair_count,
                    retry_count=record.retry_count,
                )
            self._finish_active_repair_queue_item("failed", result.summary)
        elif result.next_state == "aborted":
            record.status = "aborted"
            record.current_stage = "aborted"
        elif result.next_state:
            record.status = "running"
            record.current_stage = result.next_state
        self._write_repository_status(result)
        self.task_store.write_run_report(record)
        if self.repository_memory_store:
            self.repository_memory_store.archive_run_summary(self.task_store.read_run_summary())

    def _preflight(self) -> RuntimeStepResult:
        selected_connector_names = self.context.memory.task_memory.get("selected_connectors", [])
        preflight = preflight_gate(
            self.context.connectors,
            selected_connector_names,
            self.context.environment,
            self.context.policy,
        )
        self.context.task_record.gate_status["preflight_gate"] = preflight
        artifacts = [
            {"type": "tool_contracts", "value": preflight["contracts"]},
            {"type": "missing_auth", "value": preflight["missing_auth"]},
            {"type": "tool_policy", "value": preflight.get("tool_policy", {})},
        ]
        if preflight["status"] != "passed":
            failure_type = preflight.get("failure_type") or "auth_error"
            self.context.task_record.intent_debt = self._make_intent_debt(
                failure_type,
                f"Preflight gate blocked: {preflight['reason']}.",
            )
            self._create_approval_requests(preflight)
            return RuntimeStepResult(
                state="preflight",
                status="blocked",
                summary=f"Preflight gate blocked: {preflight['reason']}.",
                actions=[{"type": "preflight_gate", "reason": preflight["reason"]}],
                artifacts=artifacts,
                next_state="blocked",
                failure_type=failure_type,
            )
        return RuntimeStepResult(
            state="preflight",
            summary="Preflight gate passed.",
            actions=[{"type": "preflight_gate", "reason": preflight["reason"]}],
            artifacts=artifacts,
            next_state="executing",
        )

    def _execute(self) -> RuntimeStepResult:
        simulation = self.context.environment.get("simulation", {})
        failure_type = classify_failure(simulation.get("failure_type"))
        actions = [
            {
                "type": "execute",
                "worktree_id": self.context.primary_worktree.worktree_id,
            }
        ]
        if failure_type:
            return RuntimeStepResult(
                state="executing",
                status="failed",
                summary=f"Execution failed with {failure_type}.",
                actions=actions,
                next_state="repairing",
                failure_type=failure_type,
            )
        selected_skill_names = self.context.memory.task_memory.get("selected_skills", [])
        skill_outputs = []
        connector_outputs = []
        source_path = self.context.environment.get("source_path")
        connector_worktree_path = (
            self.context.environment.get("worktree_path")
            or self.context.primary_worktree.path
        )
        connector_repo_path = self.context.environment.get("git_path") or source_path or connector_worktree_path
        for skill in self.context.skills:
            if skill.name in selected_skill_names:
                skill_outputs.append(
                    execute_skill(
                        skill,
                        {
                            "goal": self.context.task_record.goal,
                            "scope": self.context.task_record.scope,
                            "entities": self.context.memory.project_memory.get("entities", []),
                            "pages": self.context.memory.project_memory.get("pages", []),
                        },
                    )
                )
        selected_connector_names = self.context.memory.task_memory.get("selected_connectors", [])
        selected_connectors = [
            connector
            for connector in self.context.connectors
            if connector.name in selected_connector_names
        ]
        selected_connectors.sort(key=_connector_execution_order)
        for connector in selected_connectors:
            connector_outputs.append(
                execute_connector(
                    connector,
                    {
                        "path": connector_worktree_path,
                        "worktree_path": connector_worktree_path,
                        "git_path": connector_repo_path,
                        "target": self.context.environment.get("browser_target", "about:blank"),
                        "ui_acceptance_paths": self.context.environment.get("ui_acceptance_paths", []),
                        "repo": self.context.environment.get("repo", "unknown"),
                        "github_command": self.context.environment.get("github_command"),
                        "github_pr_number": self.context.environment.get("github_pr_number"),
                        "github_head_ref": self.context.environment.get("github_head_ref"),
                        "github_base_ref": self.context.environment.get("github_base_ref"),
                        "figma_file_key": self.context.environment.get("figma_file_key"),
                        "figma_node_id": self.context.environment.get("figma_node_id"),
                        "product_design_brief": self.context.environment.get("product_design_brief"),
                        "product_design_target": self.context.environment.get("product_design_target"),
                        "git_command": self.context.environment.get("git_command"),
                        "git_base_ref": self.context.environment.get("git_base_ref"),
                        "cli_command": self.context.environment.get("cli_command"),
                        "cli_path": self.context.environment.get("cli_path") or source_path or connector_worktree_path,
                        "codex_command": self.context.environment.get("codex_command"),
                        "codex_path": self.context.environment.get("codex_path") or connector_worktree_path,
                        "test_command": self.context.environment.get("test_command"),
                        "test_setup_command": self.context.environment.get("test_setup_command"),
                        "test_suites": self.context.environment.get("test_suites"),
                        "mcp_command": self.context.environment.get("mcp_command"),
                        "mcp_server_command": self.context.environment.get("mcp_server_command"),
                        "mcp_tool_name": self.context.environment.get("mcp_tool_name"),
                        "mcp_tool_arguments": self.context.environment.get("mcp_tool_arguments"),
                        "connector_timeout_seconds": self.context.environment.get("connector_timeout_seconds"),
                    },
                )
            )
        artifacts = [{"type": "execution_log", "worktree_id": self.context.primary_worktree.worktree_id}]
        failed_connector = next((output for output in connector_outputs if output.get("status") == "failed"), None)
        if failed_connector:
            artifacts.extend(failed_connector.get("artifacts", []))
            actions.append(
                {
                    "type": "connector_failed",
                    "connector": failed_connector["connector"],
                    "status": failed_connector["status"],
                }
            )
            return RuntimeStepResult(
                state="executing",
                status="failed",
                summary=failed_connector["summary"],
                actions=actions,
                artifacts=artifacts,
                next_state="repairing",
                failure_type=failed_connector.get("failure_type") or "unknown",
            )
        subagent_outputs = []
        for subagent in self.context.subagents:
            if subagent.status == "running":
                completed = self.subagent_manager.run(subagent)
                subagent_outputs.append(completed)
        for output in skill_outputs:
            artifacts.extend(output.get("artifacts", []))
            actions.append({"type": "skill_executed", "skill": output["skill"], "status": output["status"]})
        for output in connector_outputs:
            artifacts.extend(output.get("artifacts", []))
            actions.append({"type": "connector_executed", "connector": output["connector"], "status": output["status"]})
        for output in subagent_outputs:
            artifacts.extend(output.artifacts)
            actions.append({"type": "subagent_completed", "subagent_id": output.subagent_id, "status": output.status})
        self.context.memory.task_memory["skill_outputs"] = skill_outputs
        self.context.memory.task_memory["connector_outputs"] = connector_outputs
        self.context.memory.task_memory["subagent_outputs"] = [output.updated_memory for output in subagent_outputs]
        return RuntimeStepResult(
            state="executing",
            summary="Execution ran in the primary worktree and executed selected skills, connectors, and sub-agents.",
            actions=actions,
            artifacts=artifacts,
            next_state="reviewing",
        )

    def _review(self) -> RuntimeStepResult:
        review = review_gate(self.context.policy, self.context.task_record.latest_report.get("actions", []), self.context.task_record.scope)
        if review["status"] != "approved":
            self.context.task_record.gate_status["review_gate"] = review
            return RuntimeStepResult(
                state="reviewing",
                status="blocked",
                summary=f"Review gate blocked: {review['reason']}.",
                next_state="blocked",
                failure_type="unknown",
            )
        self.context.task_record.gate_status["review_gate"] = review
        return RuntimeStepResult(
            state="reviewing",
            summary="Review gate passed.",
            actions=[{"type": "review_gate", "reason": review["reason"]}],
            next_state="verifying",
        )

    def _verify(self) -> RuntimeStepResult:
        eval_cases = self.context.environment.get("eval_cases") or []
        if eval_cases:
            eval_result = run_eval_cases(eval_cases, self.context.task_record.artifacts)
            self.context.task_record.artifacts.append({"type": "eval_summary", "value": eval_result})
            self.context.task_record.gate_status["eval_gate"] = eval_result
            if eval_result["status"] != "passed":
                return RuntimeStepResult(
                    state="verifying",
                    status="failed",
                    summary="Eval gate failed.",
                    artifacts=[{"type": "eval_summary", "value": eval_result}],
                    next_state="repairing",
                    failure_type="code_error",
                )
        verification = verification_gate(
            self.context.policy,
            self.context.task_record.acceptance,
            self.context.task_record.artifacts,
        )
        if verification["status"] != "verified":
            self.context.task_record.gate_status["verification_gate"] = verification
            return RuntimeStepResult(
                state="verifying",
                status="failed",
                summary=f"Verification failed: {verification['reason']}.",
                next_state="repairing",
                failure_type="unknown",
            )
        self.context.task_record.gate_status["verification_gate"] = verification
        merge = merge_gate(self.context.policy, self.context.task_record.artifacts, self.context.task_record.gate_status)
        self.context.task_record.gate_status["merge_gate"] = merge
        if merge["status"] != "passed":
            return RuntimeStepResult(
                state="verifying",
                status="blocked",
                summary=f"Merge gate blocked: {merge['reason']}.",
                actions=[
                    {"type": "verify", "acceptance": self.context.task_record.acceptance},
                    {"type": "merge_gate", "reason": merge["reason"]},
                ],
                next_state="blocked",
                failure_type="unknown",
            )
        return RuntimeStepResult(
            state="verifying",
            summary="Review and verification gates passed.",
            actions=[
                {"type": "verify", "acceptance": self.context.task_record.acceptance},
                {"type": "merge_gate", "reason": merge["reason"]},
            ],
            next_state="completed",
        )

    def _repair(self) -> RuntimeStepResult:
        record = self.context.task_record
        retry_limit = self.context.policy.get("retry_limit", 3)
        self_repair_limit = self.context.policy.get("self_repair_limit", 3)
        failure_type = record.failure_history[-1]["failure_type"] if record.failure_history else "unknown"
        if failure_type in STOP_FAILURES:
            record.intent_debt = self._make_intent_debt(failure_type, "stopped for production risk")
            return RuntimeStepResult(
                state="repairing",
                status="blocked",
                summary="Repair stopped because failure is high risk.",
                next_state="blocked",
                failure_type=failure_type,
            )
        if failure_type in BLOCKING_FAILURES:
            record.intent_debt = self._make_intent_debt(failure_type, "missing permission/auth/config/clarity")
            return RuntimeStepResult(
                state="repairing",
                status="blocked",
                summary=f"Repair blocked by {failure_type}.",
                next_state="blocked",
                failure_type=failure_type,
            )
        if should_retry(failure_type, record.retry_count, retry_limit):
            record.retry_count += 1
            return RuntimeStepResult(
                state="repairing",
                status="retrying",
                summary=f"Retrying after {failure_type}; attempt {record.retry_count} of {retry_limit}.",
                actions=[{"type": "retry", "failure_type": failure_type, "retry_count": record.retry_count}],
                next_state="executing",
                failure_type=failure_type,
            )
        if should_self_repair(failure_type, record.repair_count, self_repair_limit):
            record.repair_count += 1
            return RuntimeStepResult(
                state="repairing",
                status="repairing",
                summary=(
                    f"Starting self-repair cycle after {failure_type}; "
                    f"cycle {record.repair_count} of {self_repair_limit}."
                ),
                actions=[
                    {
                        "type": "self_repair_cycle",
                        "failure_type": failure_type,
                        "repair_count": record.repair_count,
                        "repair_limit": self_repair_limit,
                        "next_stage": "planning",
                    }
                ],
                artifacts=[
                    {
                        "type": "self_repair_plan",
                        "value": {
                            "failure_type": failure_type,
                            "source_stage": record.failure_history[-1].get("stage"),
                            "summary": record.failure_history[-1].get("summary"),
                            "next_stage": "planning",
                            "required_actions": [
                                "reuse failure history",
                                "rebuild issue plan",
                                "reroute connectors and skills",
                                "execute verification again",
                            ],
                        },
                    }
                ],
                next_state="planning",
                failure_type=failure_type,
            )
        reason = "self-repair limit exhausted" if failure_type == "code_error" else "retry limit exhausted"
        record.intent_debt = self._make_intent_debt(failure_type, reason)
        return RuntimeStepResult(
            state="repairing",
            status="blocked",
            summary=f"Repair moved to intent debt after {failure_type}.",
            next_state="blocked",
            failure_type=failure_type,
        )

    def _make_intent_debt(self, failure_type: str, reason: str) -> dict:
        return {
            "goal": self.context.task_record.goal,
            "failure_type": failure_type,
            "reason": reason,
            "next_step": _intent_debt_next_step(failure_type),
            "created_at": utc_now(),
        }

    def _create_approval_requests(self, preflight: dict) -> None:
        if not self.repository_memory_store:
            return
        tool_policy = preflight.get("tool_policy") or {}
        for decision in tool_policy.get("blocked", []):
            request = self.repository_memory_store.create_approval_request(
                task_id=self.context.task_record.task_id,
                approval_type="tool_policy",
                subject=str(decision.get("connector") or decision.get("target") or "unknown"),
                reason=str(decision.get("reason") or preflight.get("reason") or "approval required"),
                risk_level=str(decision.get("risk_level") or "unknown"),
            )
            self.context.task_record.artifacts.append({"type": "approval_request", "value": request})

    def _finish_active_repair_queue_item(self, status: str, summary: str) -> None:
        if not self.repository_memory_store:
            return
        item = self.context.memory.task_memory.get("active_repair_queue_item")
        if not item:
            return
        source_task_id = item.get("source_task_id")
        if not source_task_id:
            return
        finished = self.repository_memory_store.finish_repair_item(
            source_task_id=str(source_task_id),
            worker_task_id=self.context.task_record.task_id,
            status=status,
            summary=summary,
        )
        if finished:
            self.context.memory.task_memory["active_repair_queue_item"] = finished
            self.context.task_record.artifacts.append({"type": "repair_queue_finish", "value": finished})

    def _heartbeat(self, stage: str) -> None:
        timestamp = utc_now()
        self.task_store.write_heartbeat(
            {
                "task_id": self.context.task_record.task_id,
                "stage": stage,
                "status": self.context.task_record.status,
                "heartbeat_at": timestamp,
            }
        )
        self.context.task_record.heartbeat_at = timestamp
        self._trace(
            "heartbeat",
            {
                "task_id": self.context.task_record.task_id,
                "stage": stage,
                "heartbeat_at": timestamp,
            },
        )

    def _trace(self, event_type: str, payload: dict) -> None:
        self.task_store.append_trace(
            {
                "task_id": self.context.task_record.task_id,
                "event_type": event_type,
                "timestamp": utc_now(),
                "payload": payload,
            }
        )

    def _append_repository_action(self, result: RuntimeStepResult) -> None:
        if not self.repository_memory_store:
            return
        self.repository_memory_store.append_action(
            task_id=self.context.task_record.task_id,
            goal=self.context.task_record.goal,
            stage=result.state,
            status=result.status,
            summary=result.summary,
            next_state=result.next_state,
            failure_type=result.failure_type,
            actions=result.actions,
            artifacts=result.artifacts,
        )

    def _write_repository_status(self, result: RuntimeStepResult) -> None:
        if not self.repository_memory_store:
            return
        record = self.context.task_record
        self.repository_memory_store.write_run_status(
            task_id=record.task_id,
            goal=record.goal,
            status=record.status,
            current_stage=record.current_stage,
            last_summary=result.summary,
            gate_status=record.gate_status,
            issue_count=len(record.issue_backlog),
            failure_count=len(record.failure_history),
            intent_debt=record.intent_debt,
        )

    def _lookup_experience(self, pattern: str) -> dict:
        if not self.memory_store:
            return {"successes": [], "failures": []}
        return self.memory_store.search_experience(self.context.memory, pattern=pattern)

    def _select_skills(self, experience: dict) -> list[str]:
        text = " ".join(
            [
                self.context.task_record.goal,
                " ".join(self.context.task_record.acceptance),
                self.context.environment.get("repo", ""),
            ]
        ).lower()
        tokens = set(re.findall(r"[a-z0-9_]+", text))
        excluded_tokens = _scope_exclusion_tokens(self.context.task_record.scope)
        ranked: list[tuple[int, int, str]] = []
        for skill in self.context.skills:
            if _skill_is_excluded(skill, excluded_tokens):
                continue
            score = 0
            if skill.domain and skill.domain.lower() in tokens:
                score += 5
            for tag in skill.tags:
                tag_tokens = set(re.findall(r"[a-z0-9_]+", tag.lower()))
                if tag.lower() in text or tokens.intersection(tag_tokens):
                    score += 3
            trigger_tokens = _trigger_summary_tokens(skill.trigger_summary)
            score += len(tokens.intersection(trigger_tokens))
            ranked.append((score, skill.priority, skill.name))
        ranked.sort(key=lambda item: (-item[0], item[1], item[2]))
        default_selection = [name for score, _, name in ranked if score > 0][:3]
        if not default_selection:
            default_selection = _generic_skill_fallback(self.context.skills)
        discouraged = {
            item["context"].get("skill")
            for item in experience.get("failures", [])
            if isinstance(item.get("context"), dict)
        }
        filtered = [name for name in default_selection if name not in discouraged]
        return filtered or default_selection

    def _select_connectors(self, experience: dict) -> list[str]:
        text = " ".join(
            [
                self.context.task_record.goal,
                " ".join(self.context.task_record.acceptance),
                " ".join(self.context.task_record.scope.get("include", [])),
                self.context.environment.get("repo", ""),
            ]
        ).lower()
        allowed_connector_names = self.context.environment.get("available_connectors")
        connector_pool = self.context.connectors
        if allowed_connector_names:
            allowed = set(allowed_connector_names)
            connector_pool = [
                connector
                for connector in self.context.connectors
                if connector.name in allowed or connector.target in allowed
            ]

        ranked: list[tuple[int, int, str]] = []
        for connector in connector_pool:
            score = 0
            if connector.name == "filesystem":
                score += 5
            if connector.name == "git" and (
                self.context.environment.get("git_command")
                or ".git" in text
                or "git" in text
                or "diff" in text
                or "commit" in text
            ):
                score += 8
            if connector.name == "cli" and (
                self.context.environment.get("cli_command")
                or "cli" in text
                or "command" in text
                or "script" in text
            ):
                score += 8
            if connector.name == "codex_executor" and (
                self.context.environment.get("codex_command")
                or "codex" in text
                or "develop" in text
                or "implementation" in text
                or "code" in text
            ):
                score += 10
            if connector.name == "test" and (
                self.context.environment.get("test_command")
                or "test" in text
                or "verify" in text
                or "ci" in text
            ):
                score += 8
            if connector.name == "mcp" and (
                self.context.environment.get("mcp_command")
                or "mcp" in text
                or "connector" in text
                or "external" in text
            ):
                score += 8
            if connector.name == "browser" and ("browser" in text or "ui" in text or "page" in text):
                score += 4
            if connector.name == "github" and (
                "github" in text
                or "pr" in text
                or "repo" in text
                or self.context.environment.get("repo")
            ):
                score += 4
            if connector.name == "figma" and (
                self.context.environment.get("figma_file_key")
                or "figma" in text
                or "design" in text
                or "canvas" in text
            ):
                score += 7
            if connector.name == "product_design" and (
                self.context.environment.get("product_design_brief")
                or "product design" in text
                or "ux" in text
                or "prototype" in text
                or "redesign" in text
            ):
                score += 7
            ranked.append((score, -connector.priority, connector.name))

        ranked.sort(reverse=True)
        default_selection = [name for score, _, name in ranked if score > 0][:4]
        if not default_selection:
            default_selection = [connector.name for connector in connector_pool[:2]]

        discouraged = {
            item["context"].get("connector")
            for item in experience.get("failures", [])
            if isinstance(item.get("context"), dict)
        }
        filtered = [name for name in default_selection if name not in discouraged]
        return filtered or default_selection


def _intent_debt_next_step(failure_type: str) -> str:
    if failure_type == "code_error":
        return "enqueue automated repair: split scope, reroute tools, and restart from planning"
    if failure_type in {"network_error", "timeout"}:
        return "enqueue delayed retry with backoff and previous failure history"
    if failure_type in {"permission_error", "auth_error"}:
        return "wait for permission or authentication, then resume from repair queue"
    if failure_type == "configuration_error":
        return "wait for required configuration, then resume from repair queue"
    if failure_type == "requirement_ambiguity":
        return "clarify acceptance criteria, then resume from repair queue"
    if failure_type == "production_risk":
        return "require explicit production approval before resuming"
    return "inspect failure history, choose repair strategy, and resume from repair queue"


def _trigger_summary_tokens(summary: str) -> set[str]:
    return {
        token
        for token in re.findall(r"[a-z0-9_]+", summary.lower())
        if token not in TRIGGER_SUMMARY_STOPWORDS
    }


def _generic_skill_fallback(skills) -> list[str]:
    generic_domains = {"analysis", "backend", "frontend"}
    generic_tags = {"prd", "planning", "architecture", "backend", "schema", "frontend", "ui", "page"}
    generic = [
        skill
        for skill in skills
        if skill.domain in generic_domains or generic_tags.intersection(set(skill.tags))
    ]
    if generic:
        return [skill.name for skill in sorted(generic, key=lambda skill: skill.priority)[:3]]
    return [skill.name for skill in skills[:3]]


def _connector_execution_order(connector) -> tuple[int, int]:
    phase_order = {
        "codex_executor": 10,
        "filesystem": 20,
        "git": 30,
        "cli": 40,
        "mcp": 45,
        "test": 50,
        "browser": 60,
        "github": 70,
        "figma": 80,
        "product_design": 80,
    }
    return (phase_order.get(connector.name, 100), connector.priority)


def _scope_exclusion_tokens(scope: dict) -> set[str]:
    return set(re.findall(r"[a-z0-9_]+", " ".join(scope.get("exclude", [])).lower()))


def _skill_is_excluded(skill, excluded_tokens: set[str]) -> bool:
    if skill.domain and skill.domain.lower() in excluded_tokens:
        return True
    for tag in skill.tags:
        tag_tokens = set(re.findall(r"[a-z0-9_]+", tag.lower()))
        if tag.lower() in excluded_tokens or excluded_tokens.intersection(tag_tokens):
            return True
    return False
