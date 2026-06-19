from __future__ import annotations

from collections import Counter
from typing import Any


def summarize_trace(events: list[dict[str, Any]]) -> dict[str, Any]:
    event_counts = Counter(str(event.get("event_type", "unknown")) for event in events)
    stages = [
        event.get("payload", {}).get("stage")
        for event in events
        if event.get("event_type") == "stage_started"
    ]
    return {
        "status": "available",
        "event_count": len(events),
        "event_types": dict(sorted(event_counts.items())),
        "stage_sequence": [stage for stage in stages if stage],
        "has_heartbeat": event_counts.get("heartbeat", 0) > 0,
        "has_terminal_event": any(
            event.get("event_type") == "stage_finished"
            and event.get("payload", {}).get("next_state") in {"completed", "blocked", "aborted"}
            for event in events
        ),
    }
