# Safe Loop System

`Safe Loop System` is a minimal agent-execution scaffold designed around three constraints:

1. Do not modify the target project by default.
2. Do not pollute the working directory with transient files.
3. Record failures and drive structured self-repair.

## What it does

- Clones a target project into an isolated sandbox under `/private/tmp`
- Runs task steps only inside the sandbox
- Records every run, step, error, and recovery attempt as JSONL
- Resets the sandbox on failure before retrying
- Produces a final summary and an optional unified diff against the original project

## Why this shape

This system is intentionally conservative. It treats the target project as source material, not a mutable workspace. The original project remains untouched unless a future explicit apply phase is added.

## Layout

- `safe_loop/cli.py`: command-line entrypoint
- `safe_loop/engine.py`: orchestration loop
- `safe_loop/sandbox.py`: isolated project snapshot management
- `safe_loop/journal.py`: run and error logging
- `safe_loop/repair.py`: failure classification and recovery planning
- `tests/`: basic unit coverage

## Example

```bash
python3 -m safe_loop run \
  --project /path/to/project \
  --task "Run tests and summarize failures" \
  --cmd "pytest -q"
```

This command:

- creates a copied sandbox of `/path/to/project`
- runs `pytest -q` in the sandbox
- logs output and failures
- retries according to the repair policy
- prints a JSON summary

## Current limits

- It does not include an embedded reasoning model
- Self-repair is deterministic policy logic, not autonomous code rewriting
- It produces diffs and records, but does not apply changes back to the source project

That is intentional. Safety and observability come first.
