from __future__ import annotations

from typing import Any


def run_eval_cases(cases: list[dict[str, Any]], artifacts: list[dict[str, Any]]) -> dict[str, Any]:
    artifact_types = {str(artifact.get("type")) for artifact in artifacts}
    results = []
    for case in cases:
        required_artifacts = set(case.get("required_artifacts") or [])
        missing = sorted(required_artifacts - artifact_types)
        results.append(
            {
                "name": case.get("name", "unnamed"),
                "status": "passed" if not missing else "failed",
                "missing_artifacts": missing,
                "required_artifacts": sorted(required_artifacts),
            }
        )
    failed = [result for result in results if result["status"] != "passed"]
    return {
        "status": "passed" if not failed else "failed",
        "total": len(results),
        "passed": len(results) - len(failed),
        "failed": len(failed),
        "results": results,
    }
