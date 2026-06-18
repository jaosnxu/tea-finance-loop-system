from __future__ import annotations


def review_gate(policy: dict, actions: list[dict], scope: dict) -> dict:
    if not policy.get("reviewer_required", False):
        return {"status": "approved", "reason": "review not required"}
    roles = policy.get("agent_roles", {})
    if policy.get("independent_review_required", False):
        writer = roles.get("writer", "writer")
        reviewer = roles.get("reviewer", "reviewer")
        if writer == reviewer:
            return {"status": "blocked", "reason": "writer and reviewer must be different"}
    for action in actions:
        if action.get("type") == "execute" and not scope.get("include"):
            return {"status": "blocked", "reason": "missing executable scope"}
    return {"status": "approved", "reason": "review checks passed"}


def verification_gate(policy: dict, acceptance: list[str], artifacts: list[dict]) -> dict:
    if not policy.get("verifier_required", False):
        return {"status": "verified", "reason": "verification not required"}
    roles = policy.get("agent_roles", {})
    if policy.get("independent_verification_required", False):
        writer = roles.get("writer", "writer")
        verifier = roles.get("verifier", "verifier")
        if writer == verifier:
            return {"status": "failed", "reason": "writer and verifier must be different"}
    if not acceptance:
        return {"status": "failed", "reason": "acceptance criteria missing"}
    if policy.get("require_test_artifact", False):
        artifact_types = {artifact.get("type") for artifact in artifacts}
        if not artifact_types.intersection({"ci_suite_summary", "stdout", "mcp_tool_result", "exit_code"}):
            return {"status": "failed", "reason": "test or tool execution artifact missing"}
    if policy.get("require_vcs_artifact", False):
        artifact_types = {artifact.get("type") for artifact in artifacts}
        if "vcs_commit_plan" not in artifact_types:
            return {"status": "failed", "reason": "VCS workflow artifact missing"}
    return {"status": "verified", "reason": "verification checks passed"}


def merge_gate(policy: dict, artifacts: list[dict], gate_status: dict) -> dict:
    if not policy.get("merge_gate_required", False):
        return {"status": "passed", "reason": "merge gate not required"}
    review = gate_status.get("review_gate", {})
    verification = gate_status.get("verification_gate", {})
    if review.get("status") != "approved":
        return {"status": "blocked", "reason": "review gate has not approved"}
    if verification.get("status") != "verified":
        return {"status": "blocked", "reason": "verification gate has not verified"}

    ci_summaries = [artifact.get("value") for artifact in artifacts if artifact.get("type") == "ci_suite_summary"]
    if policy.get("require_test_artifact", False) and not ci_summaries:
        return {"status": "blocked", "reason": "CI suite summary missing"}
    for summary in ci_summaries:
        if isinstance(summary, dict) and summary.get("failed", 0) > 0:
            return {"status": "blocked", "reason": "CI suite has failed tests"}

    if policy.get("require_vcs_artifact", False):
        artifact_types = {artifact.get("type") for artifact in artifacts}
        if "vcs_commit_plan" not in artifact_types:
            return {"status": "blocked", "reason": "VCS commit plan missing"}
    if policy.get("require_remote_pr_artifact", False):
        remote_status = [artifact.get("value") for artifact in artifacts if artifact.get("type") == "github_remote_status"]
        if not remote_status:
            return {"status": "blocked", "reason": "GitHub remote PR status missing"}
        if not any(isinstance(status, dict) and status.get("available") for status in remote_status):
            return {"status": "blocked", "reason": "GitHub remote PR status is not available"}

    return {"status": "passed", "reason": "merge gate passed"}
