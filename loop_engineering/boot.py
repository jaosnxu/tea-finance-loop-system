from __future__ import annotations

from .memory_store import MemoryStore
from .models import BootPayload, RuntimeContext, TaskRecord
from .registry import ConnectorRegistry, SkillRegistry
from .repository_memory import RepositoryMemory
from .runtime import LoopRuntime
from .subagent_runner import SubAgentManager, SubAgentStore
from .task_store import TaskStore
from .worktree_manager import WorktreeManager
from .workflow import workflow_manifest


class LoopBootError(ValueError):
    pass


def validate_boot_payload(payload: BootPayload) -> None:
    if not payload.goal:
        raise LoopBootError("goal is required")
    if not payload.scope:
        raise LoopBootError("scope is required")
    if not payload.acceptance:
        raise LoopBootError("acceptance is required")
    if not payload.environment:
        raise LoopBootError("environment is required")
    if not payload.policy:
        raise LoopBootError("policy is required")
    if not payload.memory:
        raise LoopBootError("memory is required")


def boot_runtime(
    payload: BootPayload,
    skill_registry_path: str,
    connector_registry_path: str,
    resume_existing: bool = False,
) -> tuple[LoopRuntime, TaskStore, MemoryStore]:
    validate_boot_payload(payload)

    task_store = TaskStore(payload.memory["record_path"], payload.task_id)
    memory_store = MemoryStore(payload.memory["record_path"], payload.memory["memory_namespace"])
    memory = memory_store.initialize()
    subagent_store = SubAgentStore(payload.memory["record_path"], payload.task_id)
    subagent_manager = SubAgentManager(subagent_store)

    skill_registry = SkillRegistry(skill_registry_path)
    connector_registry = ConnectorRegistry(connector_registry_path)
    repository_memory_store = _build_repository_memory(payload.environment)
    repository_memory_snapshot = (
        repository_memory_store.read_required_context() if repository_memory_store else {}
    )

    worktree_manager = WorktreeManager(payload.environment["worktree_root"], payload.task_id)
    if resume_existing and task_store.exists():
        task_record = task_store.load()
        if task_record.active_worktrees:
            primary_worktree = worktree_manager.load(task_record.active_worktrees[0])
        else:
            primary_worktree = worktree_manager.create_primary(
                goal=payload.goal,
                scope=payload.scope,
                source_path=payload.environment.get("source_path"),
            )
            task_record.active_worktrees = [primary_worktree.worktree_id]
            task_store.save(task_record)
    else:
        primary_worktree = worktree_manager.create_primary(
            goal=payload.goal,
            scope=payload.scope,
            source_path=payload.environment.get("source_path"),
        )

        task_record = TaskRecord(
            task_id=payload.task_id,
            goal=payload.goal,
            scope=payload.scope,
            acceptance=payload.acceptance,
            active_worktrees=[primary_worktree.worktree_id],
        )
        task_store.save(task_record)

    memory.task_memory.update(
        {
            "task_id": payload.task_id,
            "goal": payload.goal,
            "constraints": payload.policy,
            "current_state": task_record.status,
            "current_stage": task_record.current_stage,
            "active_worktrees": [primary_worktree.worktree_id],
        }
    )
    memory.system_memory.update(
        {
            "available_skills": [skill.name for skill in skill_registry.list_active()],
            "available_connectors": [connector.name for connector in connector_registry.list_active()],
            "workflow_manifest": workflow_manifest(),
        }
    )
    if repository_memory_snapshot:
        memory.project_memory["repository_memory"] = {
            "root": repository_memory_snapshot["root"],
            "loaded_files": sorted(repository_memory_snapshot["files"].keys()),
            "recent_action_count": len(repository_memory_snapshot["recent_actions"]),
            "recent_intent_debt_count": len(repository_memory_snapshot["recent_intent_debt"]),
            "recent_success_count": len(repository_memory_snapshot["recent_successes"]),
            "recent_failure_count": len(repository_memory_snapshot["recent_failures"]),
            "current_status": repository_memory_snapshot["current_status"],
        }
    memory_store.save(memory)

    subagents = subagent_store.load_many(task_record.active_subagents) if resume_existing else []

    context = RuntimeContext(
        task_record=task_record,
        memory=memory,
        skills=skill_registry.list_active(),
        connectors=connector_registry.list_active(),
        primary_worktree=primary_worktree,
        subagents=subagents,
        environment=payload.environment,
        policy=payload.policy,
        repository_memory=repository_memory_snapshot,
    )
    runtime = LoopRuntime(context, task_store, subagent_manager, memory_store, repository_memory_store)
    return runtime, task_store, memory_store


def _build_repository_memory(environment: dict) -> RepositoryMemory | None:
    repository_memory_path = environment.get("repository_memory_path")
    if not repository_memory_path:
        return None
    path = repository_memory_path
    if not str(path).startswith("/"):
        repository_root = environment.get("repository_root") or environment.get("source_path") or "."
        path = f"{repository_root}/{repository_memory_path}"
    return RepositoryMemory(path)
