from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class WorkflowStage:
    name: str
    standard_name: str
    purpose: str


STANDARD_WORKFLOW_STAGES = [
    WorkflowStage("intake", "intake", "accept goal, scope, and acceptance criteria"),
    WorkflowStage("understanding", "context_building", "load task context and external memory"),
    WorkflowStage("planning", "planning", "build a bounded execution plan"),
    WorkflowStage("routing", "tool_routing", "select skills, tools, connectors, and sub-agents"),
    WorkflowStage("preflight", "preflight_gate", "check tool contracts, auth requirements, and execution readiness"),
    WorkflowStage("executing", "tool_execution", "execute selected skills and connectors"),
    WorkflowStage("reviewing", "review_gate", "run independent review checks"),
    WorkflowStage("verifying", "verification_gate", "run tests and acceptance checks"),
    WorkflowStage("repairing", "repair_loop", "classify failure and retry or record intent debt"),
    WorkflowStage("completed", "terminal_completed", "task completed"),
    WorkflowStage("blocked", "terminal_blocked", "task blocked with intent debt"),
    WorkflowStage("aborted", "terminal_aborted", "task aborted by policy"),
]


STANDARD_COMPONENT_NAMES = {
    "runtime": "graph_runtime",
    "workflow": "durable_workflow",
    "connector": "tool_connector",
    "mcp": "mcp_tool_adapter",
    "git": "vcs_adapter",
    "github": "remote_pr_adapter",
    "figma": "figma_canvas_adapter",
    "product_design": "product_design_workflow_adapter",
    "test": "ci_test_runner",
    "cli": "local_cli_adapter",
    "memory": "memory_spine",
    "issue": "issue_backlog",
    "preflight": "preflight_gate",
    "review": "review_gate",
    "verification": "verification_gate",
    "merge": "merge_gate",
    "trace": "observability_trace",
    "report": "run_report",
    "debt": "intent_debt",
}


def workflow_manifest() -> dict:
    return {
        "architecture": "graph_runtime + durable_workflow + tool_connectors + memory_spine + review_gate + verification_gate + observability_trace",
        "components": STANDARD_COMPONENT_NAMES,
        "stages": [
            {
                "name": stage.name,
                "standard_name": stage.standard_name,
                "purpose": stage.purpose,
            }
            for stage in STANDARD_WORKFLOW_STAGES
        ],
    }
