# Repository Memory

This directory is the durable memory spine for Loop Engineering.

Rules:
- Read this directory before planning or execution.
- Record every Loop stage result in `action_log.jsonl`.
- Keep the latest task status in `current_status.json`.
- Persist blocked intent debt in `intent_debt.jsonl`.
- Store per-task run snapshots in `runs/`.
- Keep project status, standards, decisions, integrations, and open questions current.
- Store reusable experience in `experience/successes.jsonl` and `experience/failures.jsonl`.
