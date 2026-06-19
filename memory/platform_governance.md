# Platform Governance

GitHub repository:
- `jaosnxu/tea-finance-loop-system`

Protected branch target:
- `main`
- Status: blocked by GitHub plan for private repository.
- GitHub API response: branch protection requires GitHub Pro or a public repository.

Required checks:
- `lint`
- `typecheck`
- `test`
- `build-smoke`
- `audit`
- Status: policy-as-code committed in `.github/branch-protection-main.json` and aligned with `.github/workflows/ci.yml`.

Production environment:
- `production`
- Status: created in GitHub.

Smoke workflow:
- `.github/workflows/production-smoke.yml`
- Manual input: `base_url`
- Default paths: `/login,/dashboard`

Secrets policy:
- Real production secrets must be configured in GitHub or the hosting platform.
- Secrets must not be committed to repository memory.
- Missing production secrets block production tasks.

Pending real values:
- Production deployment URL.
- Production database URL.
- Production auth secret.
- Production iiko credentials, if used.
- Production OCR/model provider credentials, if used.

Platform blockers:
- Enable GitHub Pro/Team branch protection for private repo, or make the repo public, then apply `.github/branch-protection-main.json`.
- Provide real production secret values before production deployment automation can run.
