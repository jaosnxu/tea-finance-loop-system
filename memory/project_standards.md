# Project Standards

Loop standards:
- Fixed workflow before autonomy.
- Each step has status, heartbeat, timeout, retry policy, review, and verification.
- Network failures can retry automatically.
- Auth, permission, production config, or unclear requirement failures become blocked intent debt.
- Writer, reviewer, and verifier gates must remain separate in records.
- Every action must be written outside conversation memory.

Tea finance standards:
- Backend business behavior should be configuration-driven.
- Organization, tax mode, currency behavior, roles, menus, and approval rules must not be hardcoded.
- UI is Russian-first in sizing and structure, with Chinese UI available for testing.
- Default currency is RUB unless organization config enables multi-currency.

