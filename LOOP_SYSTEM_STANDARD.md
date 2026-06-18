# Loop System Standard

This repository implements Loop Engineering as a reusable execution system.

## Functional Standard

1. Intake
- Accept goal, scope, exclusions, acceptance criteria, environment, policy, and memory namespace.
- Create a durable task id and task record.

2. Understanding
- Read task scope and acceptance criteria.
- Read repository memory before planning.
- Load project context, standards, backlog, current status, recent actions, intent debt, failures, and successes.

3. Planning
- Convert the goal into small issue backlog items.
- Keep each item bounded and acceptance-driven.

4. Routing
- Select skills, connectors, and sub-agents from registries.
- Do not invent hidden tools outside registry contracts.

5. Preflight
- Check connector contracts.
- Resolve auth requirements.
- Block missing auth/config when policy requires enforcement.

6. Execution
- Run selected skills and connectors in the scoped worktree.
- Write artifacts for every meaningful output.
- Keep tool timeouts and failure classification.

7. Review
- Run an independent review gate.
- Writer and reviewer must be separable by policy.

8. Verification
- Run tests, CI signals, browser/UI acceptance evidence, or MCP/tool evidence according to task policy.
- Writer and verifier must be separable by policy.

9. Merge Gate
- Require review and verification success.
- Require local CI/test artifacts when enabled.
- Require remote GitHub PR/status checks when enabled.
- Do not merge when required checks fail.

10. Repair
- Retry only retryable failures such as network errors and timeouts.
- Block auth, permission, configuration, requirement ambiguity, or production risk failures.
- Write intent debt and regression candidates.

11. Memory
- Append every stage result to `memory/action_log.jsonl`.
- Write latest status to `memory/current_status.json`.
- Write task snapshots to `memory/runs/`.
- Write failures and successes to `memory/experience/`.
- Write blocked intent debt to `memory/intent_debt.jsonl`.
- Write regression candidates to `memory/regression_candidates.jsonl`.

12. Production Risk
- Production writes require explicit human approval.
- Secrets must not be written to repository memory.
- Production tasks require review, verification, remote CI, and smoke test evidence.

## Maturity Levels

Level 1: Fixed workflow, task records, and reports.
Level 2: File-based skills/connectors and external memory.
Level 3: Review, verification, retry, intent debt, and regression capture.
Level 4: GitHub PR workflow, remote CI/status checks, browser/UI acceptance.
Level 5: Production controls, branch protection, secrets governance, and automated smoke tests.

Current repository target: Level 4 foundation with Level 5 policy rules documented.
