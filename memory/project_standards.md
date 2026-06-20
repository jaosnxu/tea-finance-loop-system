# Project Standards

Loop standards:
- Fixed workflow before autonomy.
- Each step has status, heartbeat, timeout, retry policy, review, and verification.
- Network failures can retry automatically.
- Code failures enter bounded self-repair before intent debt.
- Exhausted self-repair creates repair queue items for future automatic resume.
- Repair queue items must be schedulable, claimable, and closed as resolved or failed.
- Stale claimed repair queue items must be requeueable.
- Human intervention must go through approval requests, not informal chat-only approval.
- Approval requests must be resolvable as approved or rejected with actor and note.
- Tool policy must separate allowed tools, high-risk tools, and production writes.
- Eval cases and regression candidates must be used to prevent repeated platform failures.
- Regression candidates must be convertible to a regression manifest.
- Auth, permission, production config, or unclear requirement failures become blocked intent debt.
- Writer, reviewer, and verifier gates must remain separate in records.
- Every action must be written outside conversation memory.

Tea finance standards:
- Backend business behavior should be configuration-driven.
- Organization, tax mode, currency behavior, roles, menus, and approval rules must not be hardcoded.
- UI is Russian-first in sizing and structure, with Chinese UI available for testing.
- Default currency is RUB unless organization config enables multi-currency.
