# Regression Policy

When a Loop run fails:
- Record the failure in repository memory.
- Classify the failure as network, timeout, permission, auth, configuration, code, requirement ambiguity, production risk, or unknown.
- Retry only retryable failure types within the configured limit.
- Convert code errors and repeated failures into regression candidates.
- Add or update tests before considering the same class of failure resolved.

Regression candidate format:
- Failure type.
- Task id.
- Affected module.
- Reproduction command or browser path.
- Expected behavior.
- Added or pending test.

