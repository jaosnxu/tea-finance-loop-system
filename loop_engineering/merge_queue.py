from __future__ import annotations

from dataclasses import dataclass
import json
import os
import subprocess
import time
from typing import Any, Protocol
from urllib import request


DEFAULT_REQUIRED_CHECKS = ["lint", "typecheck", "test", "build-smoke", "audit"]


class GitHubClient(Protocol):
    def request(self, method: str, path: str, payload: dict[str, Any] | None = None) -> tuple[int, dict[str, Any]]:
        ...


@dataclass(frozen=True)
class MergeQueueConfig:
    repo: str
    token: str
    target_base: str = "main"
    merge_method: str = "merge"
    required_checks: tuple[str, ...] = tuple(DEFAULT_REQUIRED_CHECKS)
    apply: bool = False
    max_mergeable_attempts: int = 12
    mergeable_poll_seconds: float = 2.5


class GitHubApiClient:
    def __init__(self, repo: str, token: str, api_base_url: str = "https://api.github.com") -> None:
        self.repo = repo
        self.token = token
        self.api_base_url = api_base_url.rstrip("/")

    def request(self, method: str, path: str, payload: dict[str, Any] | None = None) -> tuple[int, dict[str, Any]]:
        body = json.dumps(payload).encode("utf-8") if payload is not None else None
        github_request = request.Request(
            f"{self.api_base_url}/repos/{self.repo}{path}",
            data=body,
            method=method,
            headers={
                "Accept": "application/vnd.github+json",
                "Authorization": f"Bearer {self.token}",
                "Content-Type": "application/json",
                "User-Agent": "loop-merge-queue",
            },
        )
        try:
            with request.urlopen(github_request, timeout=30) as response:
                raw = response.read().decode("utf-8")
                return response.status, json.loads(raw) if raw else {}
        except request.HTTPError as error:
            raw = error.read().decode("utf-8")
            try:
                body_json = json.loads(raw) if raw else {}
            except json.JSONDecodeError:
                body_json = {"raw": raw}
            return error.code, body_json


class MergeQueueRunner:
    def __init__(self, config: MergeQueueConfig, client: GitHubClient | None = None) -> None:
        self.config = config
        self.client = client or GitHubApiClient(repo=config.repo, token=config.token)

    def run(self, queue: list[int]) -> dict[str, Any]:
        events: list[dict[str, Any]] = []
        for pr_number in queue:
            pr = self._wait_for_mergeable(pr_number)
            if pr.get("state") == "closed":
                events.append(
                    {
                        "action": "skip_closed",
                        "base": pr.get("base", {}).get("ref"),
                        "head": pr.get("head", {}).get("ref"),
                        "merged": pr.get("merged"),
                        "pr": pr_number,
                    }
                )
                continue

            if pr.get("base", {}).get("ref") != self.config.target_base:
                if not self.config.apply:
                    events.append(
                        {
                            "action": "would_patch_base",
                            "currentBase": pr.get("base", {}).get("ref"),
                            "pr": pr_number,
                            "targetBase": self.config.target_base,
                        }
                    )
                else:
                    status, patch_body = self.client.request("PATCH", f"/pulls/{pr_number}", {"base": self.config.target_base})
                    events.append(
                        {
                            "action": "patch_base",
                            "currentBase": pr.get("base", {}).get("ref"),
                            "message": patch_body.get("message"),
                            "ok": 200 <= status < 300,
                            "pr": pr_number,
                            "status": status,
                            "targetBase": self.config.target_base,
                        }
                    )
                    if not 200 <= status < 300:
                        break
                    pr = self._wait_for_mergeable(pr_number)

            check_runs = self._check_runs(pr["head"]["sha"])
            required_green = self._required_checks_green(check_runs)
            events.append(
                {
                    "action": "pre_merge",
                    "base": pr.get("base", {}).get("ref"),
                    "checks": self._summarize_checks(check_runs),
                    "head": pr.get("head", {}).get("ref"),
                    "mergeable": pr.get("mergeable"),
                    "mergeableState": pr.get("mergeable_state"),
                    "pr": pr_number,
                    "requiredGreen": required_green,
                    "sha": pr["head"]["sha"],
                    "state": pr.get("state"),
                }
            )

            if pr.get("mergeable") is not True or pr.get("mergeable_state") == "dirty" or not required_green:
                events.append({"action": "blocked", "pr": pr_number, "reason": "not_mergeable_or_required_checks_not_green"})
                break

            if not self.config.apply:
                events.append({"action": "would_merge", "pr": pr_number, "sha": pr["head"]["sha"]})
                continue

            status, merge_body = self.client.request(
                "PUT",
                f"/pulls/{pr_number}/merge",
                {
                    "commit_title": f"Merge PR #{pr_number}",
                    "merge_method": self.config.merge_method,
                    "sha": pr["head"]["sha"],
                },
            )
            ok = 200 <= status < 300
            events.append(
                {
                    "action": "merge",
                    "message": merge_body.get("message"),
                    "merged": merge_body.get("merged", False),
                    "ok": ok,
                    "pr": pr_number,
                    "sha": merge_body.get("sha"),
                    "status": status,
                }
            )
            if not ok:
                events.append({"action": "blocked", "pr": pr_number, "reason": merge_body.get("message", "merge_failed")})
                break

        return {
            "apply": self.config.apply,
            "queue": [str(item) for item in queue],
            "repo": self.config.repo,
            "requiredChecks": list(self.config.required_checks),
            "targetBase": self.config.target_base,
            "events": events,
        }

    def _wait_for_mergeable(self, pr_number: int) -> dict[str, Any]:
        pr: dict[str, Any] | None = None
        for _ in range(self.config.max_mergeable_attempts):
            status, body = self.client.request("GET", f"/pulls/{pr_number}")
            if not 200 <= status < 300:
                raise RuntimeError(f"Failed to fetch PR #{pr_number}: {status} {body.get('message', '')}")
            pr = body
            if body.get("mergeable") is not None or body.get("state") == "closed":
                return body
            time.sleep(self.config.mergeable_poll_seconds)
        if pr is None:
            raise RuntimeError(f"Failed to fetch PR #{pr_number}")
        return pr

    def _check_runs(self, sha: str) -> list[dict[str, Any]]:
        page = 1
        check_runs: list[dict[str, Any]] = []
        while True:
            status, body = self.client.request("GET", f"/commits/{sha}/check-runs?per_page=100&page={page}")
            if not 200 <= status < 300:
                raise RuntimeError(f"Failed to fetch check runs for {sha}: {status} {body.get('message', '')}")
            page_runs = list(body.get("check_runs", []))
            check_runs.extend(page_runs)
            if len(page_runs) < 100:
                return check_runs
            page += 1

    def _required_checks_green(self, check_runs: list[dict[str, Any]]) -> bool:
        return all(
            any(run.get("name") == name and run.get("status") == "completed" and run.get("conclusion") == "success" for run in check_runs)
            for name in self.config.required_checks
        )

    def _summarize_checks(self, check_runs: list[dict[str, Any]]) -> list[dict[str, Any]]:
        summary = []
        for name in self.config.required_checks:
            run = next((item for item in check_runs if item.get("name") == name), None)
            summary.append(
                {
                    "conclusion": run.get("conclusion") if run else None,
                    "name": name,
                    "status": run.get("status") if run else "missing",
                }
            )
        return summary


def read_token_from_environment() -> str | None:
    return os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN") or os.environ.get("GITHUB_PAT")


def read_token_from_git_credential() -> str | None:
    try:
        completed = subprocess.run(
            ["git", "credential", "fill"],
            input="protocol=https\nhost=github.com\n\n",
            capture_output=True,
            text=True,
            check=False,
        )
    except FileNotFoundError:
        return None
    if completed.returncode != 0:
        return None
    for line in completed.stdout.splitlines():
        if line.startswith("password="):
            return line.removeprefix("password=")
    return None


def read_repo_from_git_remote() -> str:
    completed = subprocess.run(["git", "remote", "get-url", "origin"], capture_output=True, text=True, check=True)
    remote = completed.stdout.strip()
    if remote.startswith("https://github.com/"):
        return remote.removeprefix("https://github.com/").removesuffix(".git")
    if remote.startswith("git@github.com:"):
        return remote.removeprefix("git@github.com:").removesuffix(".git")
    raise RuntimeError(f"Unsupported GitHub remote: {remote}")
