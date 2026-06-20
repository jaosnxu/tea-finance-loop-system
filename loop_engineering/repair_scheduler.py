from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from .repository_memory import RepositoryMemory


def plan_repair_queue(
    memory: RepositoryMemory,
    *,
    max_items: int = 5,
    stale_claim_minutes: int = 60,
) -> dict[str, Any]:
    open_items = memory.list_repair_items(status="open", limit=10000)
    claimed_items = memory.list_repair_items(status="claimed", limit=10000)
    stale_claims = [
        item
        for item in claimed_items
        if _is_stale(item.get("timestamp"), stale_claim_minutes=stale_claim_minutes)
    ]
    claimable = [
        item
        for item in open_items
        if item.get("queue_class") in {"automated_repair", "delayed_retry"}
    ][:max_items]
    blocked = [
        item
        for item in open_items
        if item.get("queue_class") in {"human_blocked", "approval_required"}
    ]
    triage = [
        item
        for item in open_items
        if item.get("queue_class") == "needs_triage"
    ]
    status = "ready" if claimable else "idle"
    if status == "idle" and (blocked or triage or stale_claims):
        status = "attention_required"
    return {
        "status": status,
        "claimable_count": len(claimable),
        "blocked_count": len(blocked),
        "triage_count": len(triage),
        "stale_claim_count": len(stale_claims),
        "claimable": claimable,
        "blocked": blocked,
        "triage": triage,
        "stale_claims": stale_claims,
        "next_actions": _next_actions(claimable, blocked, triage, stale_claims),
    }


def requeue_stale_claims(
    memory: RepositoryMemory,
    *,
    stale_claim_minutes: int = 60,
    reason: str = "stale claim exceeded timeout",
) -> dict[str, Any]:
    plan = plan_repair_queue(memory, stale_claim_minutes=stale_claim_minutes)
    requeued = []
    for item in plan["stale_claims"]:
        source_task_id = item.get("source_task_id")
        if not source_task_id:
            continue
        result = memory.requeue_repair_item(source_task_id=str(source_task_id), reason=reason)
        if result:
            requeued.append(result)
    return {
        "status": "completed",
        "requeued_count": len(requeued),
        "requeued": requeued,
    }


def _is_stale(timestamp: str | None, *, stale_claim_minutes: int) -> bool:
    if not timestamp:
        return True
    try:
        value = datetime.fromisoformat(timestamp)
    except ValueError:
        return True
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return datetime.now(timezone.utc) - value > timedelta(minutes=stale_claim_minutes)


def _next_actions(
    claimable: list[dict[str, Any]],
    blocked: list[dict[str, Any]],
    triage: list[dict[str, Any]],
    stale_claims: list[dict[str, Any]],
) -> list[str]:
    actions = []
    if claimable:
        actions.append("start worker tasks for claimable automated repair or delayed retry items")
    if stale_claims:
        actions.append("inspect stale claimed repair items and requeue or close them")
    if blocked:
        actions.append("route human-blocked and approval-required items to approval inbox")
    if triage:
        actions.append("triage unknown failure repair items and assign queue class before retry")
    if not actions:
        actions.append("no repair queue action required")
    return actions
