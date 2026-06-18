import unittest
from pathlib import Path

from loop_engineering.models import SkillMeta
from loop_engineering.skill_runner import execute_skill


REPO_ROOT = Path(__file__).resolve().parents[1]


class SkillExecutionTests(unittest.TestCase):
    def test_marketing_brand_social_campaign_skill_outputs_campaign_package(self) -> None:
        skill = SkillMeta(
            name="marketing.brand-social-campaign",
            version="v1",
            status="stable",
            domain="marketing",
            tags=["brand", "social", "campaign"],
            owner="system",
            entry=str(REPO_ROOT / "loop_registry" / "skills" / "marketing.brand-social-campaign.v1.json"),
            input_schema="",
            output_schema="",
            trigger_summary="Use for brand and social media campaign planning.",
            priority=12,
            standard_name="marketing_skill",
        )
        result = execute_skill(
            skill,
            {
                "goal": "Create a social media campaign for a tea brand.",
                "social_channels": ["instagram", "telegram"],
            },
        )
        artifact_types = {artifact["type"] for artifact in result["artifacts"]}
        channels = next(artifact["value"] for artifact in result["artifacts"] if artifact["type"] == "social_channels")

        self.assertEqual(result["status"], "completed")
        self.assertIn("marketing_strategy_tracks", artifact_types)
        self.assertIn("creative_asset_brief", next(artifact["value"] for artifact in result["artifacts"] if artifact["type"] == "marketing_strategy_tracks"))
        self.assertEqual(channels, ["instagram", "telegram"])
        self.assertIn("acceptance_criteria", artifact_types)


if __name__ == "__main__":
    unittest.main()
