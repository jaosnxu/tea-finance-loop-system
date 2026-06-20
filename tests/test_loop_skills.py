import unittest
from pathlib import Path

from loop_engineering.models import SkillMeta
from loop_engineering.skill_runner import execute_skill


REPO_ROOT = Path(__file__).resolve().parents[1]


class SkillExecutionTests(unittest.TestCase):
    def test_loop_system_bootstrap_skill_outputs_governance_package(self) -> None:
        skill = SkillMeta(
            name="loop.system-bootstrap",
            version="v1",
            status="core",
            domain="loop",
            tags=["loop", "bootstrap", "governance"],
            owner="system",
            entry=str(REPO_ROOT / "loop_registry" / "skills" / "loop.system-bootstrap.v1.json"),
            input_schema="",
            output_schema="",
            trigger_summary="Use for creating a reusable Loop Engineering system.",
            priority=4,
            standard_name="loop_system_skill",
        )
        result = execute_skill(
            skill,
            {
                "goal": "Build a reusable Loop Engineering system for a new workspace.",
            },
        )
        artifact_types = {artifact["type"] for artifact in result["artifacts"]}
        tracks = next(artifact["value"] for artifact in result["artifacts"] if artifact["type"] == "loop_bootstrap_tracks")
        separation_rules = next(artifact["value"] for artifact in result["artifacts"] if artifact["type"] == "separation_rules")

        self.assertEqual(result["status"], "completed")
        self.assertIn("loop_bootstrap_tracks", artifact_types)
        self.assertIn("project_memory_spine", tracks)
        self.assertIn("ci_required_checks", tracks)
        self.assertIn("do_not_mix_skill_creation_with_app_feature_work", separation_rules)


if __name__ == "__main__":
    unittest.main()
