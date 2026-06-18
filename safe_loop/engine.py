from __future__ import annotations

from dataclasses import asdict
import json

from .journal import Journal
from .models import RunConfig, RunRecord, StepResult, utc_now
from .repair import choose_recovery_action, classify_failure
from .sandbox import Sandbox


class SafeLoopEngine:
    def __init__(self, config: RunConfig) -> None:
        self.config = config
        self.record = RunRecord()
        self.journal = Journal(config.state_root, self.record.run_id)
        self.sandbox = Sandbox(
            project_path=config.project_path,
            sandbox_root=config.sandbox_root,
            run_id=self.record.run_id,
        )

    def run(self) -> dict:
        self.journal.write_dataclass("run_started", self.record)
        self.sandbox.prepare()

        for attempt in range(1, self.config.max_attempts + 1):
            started_at = utc_now()
            result = self.sandbox.run(self.config.command)
            finished_at = utc_now()
            category = classify_failure(result.returncode, result.stdout, result.stderr)
            recovery_action = choose_recovery_action(
                category,
                attempt,
                self.config.max_attempts,
            )

            step = StepResult(
                attempt=attempt,
                command=self.config.command,
                returncode=result.returncode,
                stdout=result.stdout,
                stderr=result.stderr,
                started_at=started_at,
                finished_at=finished_at,
                category=category,
                recovery_action=recovery_action,
            )
            self.record.attempts.append(step)
            self.journal.write_dataclass("step_finished", step)

            if result.returncode == 0:
                self.record.status = "completed"
                break

            if recovery_action == "reset_and_retry":
                self.journal.write_event(
                    "recovery_started",
                    {"attempt": attempt, "action": recovery_action},
                )
                self.sandbox.reset()
                continue

            self.record.status = "failed"
            break
        else:
            self.record.status = "failed"

        self.record.summary = {
            "run_id": self.record.run_id,
            "status": self.record.status,
            "task": self.config.task,
            "command": self.config.command,
            "attempt_count": len(self.record.attempts),
            "last_error_category": self.record.attempts[-1].category
            if self.record.attempts
            else None,
            "sandbox_diff": self.sandbox.diff(),
        }
        summary = asdict(self.record)
        self.journal.write_summary(summary)
        return summary

    @staticmethod
    def format_summary(summary: dict) -> str:
        return json.dumps(summary, indent=2, ensure_ascii=True)
