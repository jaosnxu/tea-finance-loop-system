from __future__ import annotations

from datetime import datetime, timezone
from typing import Any


def evaluate_heartbeat(record: Any, timeout_seconds: int) -> dict:
    heartbeat_at = getattr(record, "heartbeat_at", None)
    if not heartbeat_at:
        return {"status": "stale", "reason": "heartbeat missing", "age_seconds": None}
    try:
        heartbeat_time = datetime.fromisoformat(heartbeat_at.replace("Z", "+00:00"))
    except ValueError:
        return {"status": "stale", "reason": "heartbeat timestamp invalid", "age_seconds": None}
    age = (datetime.now(timezone.utc) - heartbeat_time).total_seconds()
    if age > timeout_seconds:
        return {"status": "stale", "reason": "heartbeat timeout exceeded", "age_seconds": age}
    return {"status": "healthy", "reason": "heartbeat within timeout", "age_seconds": age}
