import tempfile
import unittest
from pathlib import Path

from safe_loop.sandbox import Sandbox


class SandboxTests(unittest.TestCase):
    def test_reset_restores_original_snapshot(self) -> None:
        with tempfile.TemporaryDirectory() as project_dir, tempfile.TemporaryDirectory() as root_dir:
            project_path = Path(project_dir)
            (project_path / "file.txt").write_text("hello", encoding="utf-8")

            sandbox = Sandbox(str(project_path), root_dir, "run-1")
            sandbox.prepare()
            (sandbox.work_dir / "file.txt").write_text("changed", encoding="utf-8")

            sandbox.reset()
            restored = (sandbox.work_dir / "file.txt").read_text(encoding="utf-8")
            self.assertEqual(restored, "hello")


if __name__ == "__main__":
    unittest.main()
