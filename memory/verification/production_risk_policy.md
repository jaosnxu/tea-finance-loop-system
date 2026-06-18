# Production Risk Policy

Production operations are not normal Loop retries.

Rules:
- Production writes require explicit human approval.
- Missing production credentials or configuration blocks the task.
- Production risk failures must enter intent debt.
- Production changes require review, verification, remote CI, and smoke test evidence.
- Secrets must not be written to repository memory.

