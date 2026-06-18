from __future__ import annotations

import json
from pathlib import Path

from .models import ConnectorMeta, SkillMeta


class SkillRegistry:
    def __init__(self, path: str) -> None:
        self.path = Path(path)
        self.skills = self._load()

    def _load(self) -> list[SkillMeta]:
        payload = json.loads(self.path.read_text(encoding="utf-8"))
        return [SkillMeta(**item) for item in payload["skills"]]

    def list_active(self) -> list[SkillMeta]:
        return [skill for skill in self.skills if skill.status in {"stable", "core"}]

    def search(self, domain: str | None = None, tags: list[str] | None = None) -> list[SkillMeta]:
        skills = self.list_active()
        if domain:
            skills = [skill for skill in skills if skill.domain == domain]
        if tags:
            required = set(tags)
            skills = [skill for skill in skills if required.intersection(skill.tags)]
        return sorted(skills, key=lambda skill: skill.priority)


class ConnectorRegistry:
    def __init__(self, path: str) -> None:
        self.path = Path(path)
        self.connectors = self._load()

    def _load(self) -> list[ConnectorMeta]:
        payload = json.loads(self.path.read_text(encoding="utf-8"))
        return [ConnectorMeta(**item) for item in payload["connectors"]]

    def list_active(self) -> list[ConnectorMeta]:
        return [connector for connector in self.connectors if connector.status in {"stable", "core"}]

    def search(self, targets: list[str] | None = None) -> list[ConnectorMeta]:
        connectors = self.list_active()
        if targets:
            required = set(targets)
            connectors = [connector for connector in connectors if connector.target in required or connector.name in required]
        return sorted(connectors, key=lambda connector: connector.priority)
