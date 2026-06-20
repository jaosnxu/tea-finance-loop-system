from __future__ import annotations

import unittest

from loop_engineering.merge_queue import DEFAULT_REQUIRED_CHECKS, MergeQueueConfig, MergeQueueRunner


PRODUCT_REQUIRED_CHECKS = ("lint", "typecheck", "test", "build-smoke", "audit")


class FakeGitHubClient:
    def __init__(self) -> None:
        self.requests: list[tuple[str, str, dict | None]] = []
        self.prs = {
            28: self._pr(28, "closed", "main", "dev/006", "sha28", merged=True),
            29: self._pr(29, "open", "dev/006", "dev/007", "sha29"),
            31: self._pr(31, "open", "dev/007", "dev/008", "sha31"),
        }
        self.merges: dict[int, tuple[int, dict]] = {
            29: (200, {"message": "Pull Request successfully merged", "merged": True, "sha": "merge29"}),
            31: (405, {"message": "At least 1 approving review is required by reviewers with write access."}),
        }

    def request(self, method: str, path: str, payload: dict | None = None) -> tuple[int, dict]:
        self.requests.append((method, path, payload))
        if method == "GET" and path.startswith("/pulls/"):
            number = int(path.split("/")[-1])
            return 200, self.prs[number]
        if method == "PATCH" and path.startswith("/pulls/"):
            number = int(path.split("/")[-1])
            assert payload is not None
            self.prs[number]["base"]["ref"] = payload["base"]
            return 200, self.prs[number]
        if method == "GET" and path.startswith("/commits/"):
            return 200, {
                "check_runs": [
                    {"name": "lint", "status": "completed", "conclusion": "success"},
                    {"name": "typecheck", "status": "completed", "conclusion": "success"},
                    {"name": "test", "status": "completed", "conclusion": "success"},
                    {"name": "build-smoke", "status": "completed", "conclusion": "success"},
                    {"name": "audit", "status": "completed", "conclusion": "success"},
                ]
            }
        if method == "PUT" and path.endswith("/merge"):
            number = int(path.split("/")[2])
            return self.merges[number]
        raise AssertionError(f"unexpected request {method} {path}")

    def _pr(self, number: int, state: str, base: str, head: str, sha: str, merged: bool = False) -> dict:
        return {
            "number": number,
            "state": state,
            "merged": merged,
            "mergeable": True,
            "mergeable_state": "clean",
            "base": {"ref": base},
            "head": {"ref": head, "sha": sha},
        }


class MergeQueueTests(unittest.TestCase):
    def test_queue_skips_merged_patches_base_merges_and_blocks_on_review_gate(self) -> None:
        client = FakeGitHubClient()
        config = MergeQueueConfig(
            repo="owner/repo",
            token="token",
            apply=True,
            mergeable_poll_seconds=0,
            required_checks=PRODUCT_REQUIRED_CHECKS,
        )
        result = MergeQueueRunner(config, client=client).run([28, 29, 31])

        actions = [event["action"] for event in result["events"]]
        self.assertEqual(actions, ["skip_closed", "patch_base", "pre_merge", "merge", "patch_base", "pre_merge", "merge", "blocked"])
        self.assertEqual(result["events"][1]["pr"], 29)
        self.assertEqual(result["events"][1]["targetBase"], "main")
        self.assertTrue(result["events"][3]["merged"])
        self.assertEqual(result["events"][-1]["pr"], 31)
        self.assertIn("approving review", result["events"][-1]["reason"])

    def test_plan_mode_does_not_patch_or_merge(self) -> None:
        client = FakeGitHubClient()
        config = MergeQueueConfig(
            repo="owner/repo",
            token="token",
            apply=False,
            mergeable_poll_seconds=0,
            required_checks=PRODUCT_REQUIRED_CHECKS,
        )
        result = MergeQueueRunner(config, client=client).run([29])

        self.assertEqual([event["action"] for event in result["events"]], ["would_patch_base", "pre_merge", "would_merge"])
        self.assertNotIn(("PATCH", "/pulls/29", {"base": "main"}), client.requests)

    def test_default_required_checks_match_loop_repository_protection(self) -> None:
        self.assertEqual(DEFAULT_REQUIRED_CHECKS, list(PRODUCT_REQUIRED_CHECKS))

    def test_fetches_all_check_run_pages(self) -> None:
        class PaginatedClient(FakeGitHubClient):
            def request(self, method: str, path: str, payload: dict | None = None) -> tuple[int, dict]:
                self.requests.append((method, path, payload))
                if method == "GET" and path.startswith("/pulls/"):
                    return 200, self.prs[29]
                if method == "GET" and path.endswith("page=1"):
                    return 200, {"check_runs": [{"name": f"extra-{index}", "status": "completed", "conclusion": "success"} for index in range(100)]}
                if method == "GET" and path.endswith("page=2"):
                    return 200, {
                        "check_runs": [
                            {"name": "final-check", "status": "completed", "conclusion": "success"},
                        ]
                    }
                raise AssertionError(f"unexpected request {method} {path}")

        client = PaginatedClient()
        config = MergeQueueConfig(
            repo="owner/repo",
            token="token",
            apply=False,
            mergeable_poll_seconds=0,
            required_checks=("final-check",),
        )
        result = MergeQueueRunner(config, client=client).run([29])

        check_paths = [path for method, path, _ in client.requests if method == "GET" and "/check-runs" in path]
        self.assertEqual(
            check_paths,
            ["/commits/sha29/check-runs?per_page=100&page=1", "/commits/sha29/check-runs?per_page=100&page=2"],
        )
        self.assertTrue(result["events"][1]["requiredGreen"])


if __name__ == "__main__":
    unittest.main()
