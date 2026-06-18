from __future__ import annotations

import os
from typing import Any


def resolve_auth_requirements(requirements: list[str], environment: dict[str, Any]) -> dict[str, Any]:
    provided = set(environment.get("provided_auth", []))
    env_map = environment.get("auth_env", {})
    resolved = []
    missing = []
    for requirement in requirements:
        env_name = env_map.get(requirement)
        is_available = requirement in provided or bool(env_name and os.environ.get(str(env_name)))
        item = {
            "requirement": requirement,
            "source": "provided_auth" if requirement in provided else ("env" if is_available else "missing"),
            "env": env_name,
            "available": is_available,
        }
        resolved.append(item)
        if not is_available:
            missing.append(item)
    return {"resolved": resolved, "missing": missing}
