# Merge Queue Runner

The merge queue runner is a Loop system capability. It belongs in this repository, not in a product repository.

## Purpose

The runner executes an ordered GitHub PR queue without ad-hoc per-step commands:

1. Read each PR in queue order.
2. Skip PRs that are already closed.
3. Move the PR base to the target base when needed.
4. Verify required checks.
5. Attempt the GitHub merge endpoint.
6. Stop with a structured blocker when GitHub rejects the merge.

## Command

Plan only:

```bash
python3 scripts/merge_queue.py --queue 28,29,31 --repo owner/repo
```

Apply:

```bash
python3 scripts/merge_queue.py --queue 28,29,31 --repo owner/repo --apply
```

## Defaults

- Target base: `main`
- Merge method: `merge`
- Required checks:
  - `Loop runtime tests`
  - `Tea finance build and tests`

These defaults match this Loop system repository. Product repositories should pass their own protected check names with `--required-checks`.

Example for `xtgzpt`:

```bash
python3 scripts/merge_queue.py --queue 28,29,31 --repo jaosnxu/xtgzpt --required-checks lint,typecheck,test,build-smoke,audit --apply
```

## Authentication

The runner reads a GitHub token from:

1. `GITHUB_TOKEN`
2. `GH_TOKEN`
3. `GITHUB_PAT`
4. local `git credential`

## Product Repository Usage

Product repositories should not copy this runner.

They should keep only project-specific records:

- which Loop system repo/version they use
- which queue was executed
- what blocker or audit result was produced

Reusable execution logic stays in `tea-finance-loop-system`.
