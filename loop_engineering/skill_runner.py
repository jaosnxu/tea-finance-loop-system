from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from .models import SkillMeta


class SkillExecutionError(RuntimeError):
    pass


def execute_skill(skill: SkillMeta, payload: dict[str, Any]) -> dict[str, Any]:
    spec = _load_skill_spec(skill.entry)
    return _render_skill_output(skill, spec, payload)


def _load_skill_spec(entry: str) -> dict[str, Any]:
    path = Path(entry)
    if not path.exists():
        raise SkillExecutionError(f"Skill entry not found: {entry}")
    return json.loads(path.read_text(encoding="utf-8"))


def _render_skill_output(skill: SkillMeta, spec: dict[str, Any], payload: dict[str, Any]) -> dict[str, Any]:
    template = spec.get("template", {})
    artifacts = []
    for artifact_spec in template.get("artifacts", []):
        if "value" in artifact_spec:
            value = artifact_spec["value"]
        else:
            key = artifact_spec.get("from_payload_key")
            value = payload.get(key, artifact_spec.get("default"))
            if value in (None, [], {}):
                value = artifact_spec.get("default")
        artifacts.append({"type": artifact_spec["type"], "value": value})
    return {
        "skill": skill.name,
        "status": "completed",
        "summary": template.get("summary", f"Executed skill {skill.name}."),
        "artifacts": artifacts,
        "next_recommendation": template.get("next_recommendation", ""),
    }
