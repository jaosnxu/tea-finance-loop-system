from __future__ import annotations

from typing import Any

from .models import ConnectorMeta


PRODUCTION_ENVIRONMENTS = {"production", "prod"}


def evaluate_tool_policy(
    connectors: list[ConnectorMeta],
    *,
    environment: dict[str, Any],
    policy: dict[str, Any],
) -> dict[str, Any]:
    decisions = [
        _connector_decision(connector, environment=environment, policy=policy)
        for connector in connectors
    ]
    blocked = [decision for decision in decisions if decision["decision"] in {"denied", "approval_required"}]
    if not blocked:
        return {
            "status": "passed",
            "reason": "tool policy passed",
            "decisions": decisions,
            "failure_type": None,
        }
    failure_type = "production_risk" if any(item["failure_type"] == "production_risk" for item in blocked) else "permission_error"
    return {
        "status": "blocked",
        "reason": "tool policy requires approval or denies execution",
        "decisions": decisions,
        "blocked": blocked,
        "failure_type": failure_type,
    }


def _connector_decision(connector: ConnectorMeta, *, environment: dict[str, Any], policy: dict[str, Any]) -> dict[str, Any]:
    denied_tools = set(policy.get("denied_tools") or [])
    approved_tools = set(policy.get("approved_tools") or [])
    environment_name = str(environment.get("environment_name") or environment.get("deployment_environment") or "").lower()
    is_production = environment_name in PRODUCTION_ENVIRONMENTS or bool(environment.get("production"))
    production_write = is_production and connector.mode == "read_write"

    base = {
        "connector": connector.name,
        "target": connector.target,
        "mode": connector.mode,
        "risk_level": connector.risk_level,
    }
    if connector.name in denied_tools:
        return {
            **base,
            "decision": "denied",
            "reason": "connector is denied by policy",
            "failure_type": "permission_error",
        }
    if connector.name in approved_tools:
        return {
            **base,
            "decision": "allowed",
            "reason": "connector is explicitly approved",
            "failure_type": None,
        }
    if production_write and not policy.get("allow_production_writes", False):
        return {
            **base,
            "decision": "approval_required",
            "reason": "production write requires explicit approval",
            "failure_type": "production_risk",
        }
    if connector.risk_level == "high" and policy.get("require_approval_for_high_risk_tools", False):
        return {
            **base,
            "decision": "approval_required",
            "reason": "high-risk connector requires approval",
            "failure_type": "permission_error",
        }
    return {
        **base,
        "decision": "allowed",
        "reason": "connector is allowed by policy",
        "failure_type": None,
    }
