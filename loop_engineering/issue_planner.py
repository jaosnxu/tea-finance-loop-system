from __future__ import annotations

from typing import Any


def create_issue_backlog(goal: str, scope: dict[str, Any], acceptance: list[str]) -> list[dict[str, Any]]:
    criteria = acceptance or ["Complete the requested goal."]
    included_scope = scope.get("include", [])
    excluded_scope = scope.get("exclude", [])
    issues = []
    for index, criterion in enumerate(criteria, start=1):
        issues.append(
            {
                "id": f"ISSUE-{index:03d}",
                "title": _title_from_criterion(criterion),
                "status": "ready",
                "priority": index,
                "goal": goal,
                "acceptance": [criterion],
                "scope": {
                    "include": included_scope,
                    "exclude": excluded_scope,
                },
                "verification": {
                    "required": True,
                    "signals": ["review_gate", "verification_gate"],
                },
            }
        )
    return issues


def _title_from_criterion(criterion: str) -> str:
    text = " ".join(criterion.strip().split())
    if not text:
        return "Complete acceptance criterion"
    return text[:76] + ("..." if len(text) > 76 else "")
