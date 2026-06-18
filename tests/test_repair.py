import unittest

from safe_loop.repair import choose_recovery_action, classify_failure


class RepairTests(unittest.TestCase):
    def test_success_classification(self) -> None:
        self.assertEqual(classify_failure(0, "", ""), "success")

    def test_environment_classification(self) -> None:
        category = classify_failure(127, "", "command not found")
        self.assertEqual(category, "environment")

    def test_retry_policy(self) -> None:
        action = choose_recovery_action("task_failure", 1, 3)
        self.assertEqual(action, "reset_and_retry")

    def test_stop_policy_after_limit(self) -> None:
        action = choose_recovery_action("task_failure", 3, 3)
        self.assertEqual(action, "stop")


if __name__ == "__main__":
    unittest.main()
