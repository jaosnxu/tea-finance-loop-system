from __future__ import annotations


RETRYABLE_FAILURES = {"network_error", "timeout"}
BLOCKING_FAILURES = {"permission_error", "auth_error", "configuration_error", "requirement_ambiguity"}
STOP_FAILURES = {"production_risk"}


def classify_failure(error_type: str | None) -> str | None:
    if not error_type:
        return None
    if error_type in {
        "network_error",
        "permission_error",
        "auth_error",
        "configuration_error",
        "code_error",
        "requirement_ambiguity",
        "production_risk",
        "timeout",
        "unknown",
    }:
        return error_type
    return "unknown"


def should_retry(error_type: str | None, retry_count: int, retry_limit: int) -> bool:
    if not error_type:
        return False
    if retry_count >= retry_limit:
        return False
    return error_type in RETRYABLE_FAILURES
