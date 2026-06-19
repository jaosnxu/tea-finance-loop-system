from __future__ import annotations

from .models import ConnectorMeta
from .platform_policy import evaluate_tool_policy
from .secret_store import resolve_auth_requirements


def preflight_gate(
    connectors: list[ConnectorMeta],
    selected_connector_names: list[str],
    environment: dict,
    policy: dict,
) -> dict:
    selected = [connector for connector in connectors if connector.name in selected_connector_names]
    contracts = [
        {
            "name": connector.name,
            "standard_name": connector.standard_name,
            "target": connector.target,
            "mode": connector.mode,
            "risk_level": connector.risk_level,
            "auth_requirements": connector.auth_requirements,
            "capabilities": connector.capabilities,
        }
        for connector in selected
    ]
    missing_auth = []
    auth_resolution = {}
    for connector in selected:
        resolution = resolve_auth_requirements(connector.auth_requirements, environment)
        auth_resolution[connector.name] = resolution["resolved"]
        for item in resolution["missing"]:
            missing_auth.append({"connector": connector.name, **item})
    tool_policy = evaluate_tool_policy(selected, environment=environment, policy=policy)

    if missing_auth and policy.get("enforce_connector_auth", False):
        return {
            "status": "blocked",
            "reason": "connector auth requirement missing",
            "contracts": contracts,
            "auth_resolution": auth_resolution,
            "missing_auth": missing_auth,
            "tool_policy": tool_policy,
            "failure_type": "auth_error",
        }
    if tool_policy["status"] != "passed" and policy.get("enforce_tool_policy", False):
        return {
            "status": "blocked",
            "reason": tool_policy["reason"],
            "contracts": contracts,
            "auth_resolution": auth_resolution,
            "missing_auth": missing_auth,
            "tool_policy": tool_policy,
            "failure_type": tool_policy["failure_type"],
        }
    return {
        "status": "passed",
        "reason": "preflight checks passed",
        "contracts": contracts,
        "auth_resolution": auth_resolution,
        "missing_auth": missing_auth,
        "tool_policy": tool_policy,
        "failure_type": None,
    }
