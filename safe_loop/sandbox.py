from __future__ import annotations

from pathlib import Path
import filecmp
import shutil
import subprocess


class Sandbox:
    def __init__(self, project_path: str, sandbox_root: str, run_id: str) -> None:
        self.project_path = Path(project_path).resolve()
        self.sandbox_root = Path(sandbox_root).resolve()
        self.run_id = run_id
        self.base_dir = self.sandbox_root / run_id
        self.snapshot_dir = self.base_dir / "snapshot"
        self.work_dir = self.base_dir / "work"

    def prepare(self) -> None:
        self.base_dir.mkdir(parents=True, exist_ok=True)
        self._copy_tree(self.project_path, self.snapshot_dir)
        self.reset()

    def reset(self) -> None:
        if self.work_dir.exists():
            shutil.rmtree(self.work_dir)
        self._copy_tree(self.snapshot_dir, self.work_dir)

    def run(self, command: str) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            command,
            cwd=self.work_dir,
            shell=True,
            text=True,
            capture_output=True,
        )

    def diff(self) -> str:
        return self._diff_dirs(self.snapshot_dir, self.work_dir)

    def _copy_tree(self, src: Path, dst: Path) -> None:
        if dst.exists():
            shutil.rmtree(dst)
        shutil.copytree(src, dst)

    def _diff_dirs(self, left: Path, right: Path) -> str:
        lines: list[str] = []
        comparison = filecmp.dircmp(left, right)
        for name in sorted(comparison.left_only):
            lines.append(f"ONLY_IN_SNAPSHOT {name}")
        for name in sorted(comparison.right_only):
            lines.append(f"ONLY_IN_WORK {name}")
        for name in sorted(comparison.diff_files):
            lines.append(f"CHANGED {name}")
        for subdir in sorted(comparison.common_dirs):
            nested = self._diff_dirs(left / subdir, right / subdir)
            if nested:
                lines.append(f"DIR {subdir}")
                lines.extend(f"  {line}" for line in nested.splitlines())
        return "\n".join(lines)
