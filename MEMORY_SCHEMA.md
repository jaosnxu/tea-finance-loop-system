# Memory Schema

## 1. 目的

这份文档定义 `Memory Spine` 的结构化数据模型。

目标是把“记忆”从抽象概念变成系统可存、可读、可写、可检索的对象。

## 2. 记忆总结构

记忆分四层：

1. `task_memory`
2. `project_memory`
3. `system_memory`
4. `experience_memory`

建议统一顶层结构：

```yaml
task_memory:
project_memory:
system_memory:
experience_memory:
```

## 3. Task Memory

记录当前任务运行时状态。

```yaml
task_memory:
  task_id:
  goal:
  constraints:
  current_state:
  current_stage:
  last_action:
  last_feedback:
  active_skills:
  active_connectors:
  active_worktrees:
  active_subagents:
  pending_questions:
  next_candidates:
  updated_at:
```

最关键字段：

- `current_stage`
- `last_action`
- `last_feedback`
- `next_candidates`

## 4. Project Memory

记录某个项目长期上下文。

```yaml
project_memory:
  project_id:
  project_name:
  domain:
  tech_stack:
  repo_structure:
  conventions:
  decisions:
  known_risks:
  reusable_patterns:
  updated_at:
```

## 5. System Memory

记录 Loop 系统自身长期规则。

```yaml
system_memory:
  runtime_version:
  default_policies:
  available_skills:
  available_connectors:
  worktree_rules:
  subagent_rules:
  memory_policies:
  updated_at:
```

## 6. Experience Memory

记录跨任务经验。

```yaml
experience_memory:
  successes:
  failures:
  recommended_skills:
  discouraged_patterns:
  common_repairs:
  updated_at:
```

其中每条 success/failure 记录应最少包含：

```yaml
- id:
  pattern:
  context:
  outcome:
  recommendation:
```

## 7. 写入规则

每轮至少写入：

- 当前阶段
- 本轮动作
- 本轮反馈
- 下一轮建议

任务收尾时额外写入：

- 成功路径或失败原因
- 可复用经验

## 8. 读取规则

- runtime 默认先读 `task_memory`
- 涉及项目约定时读 `project_memory`
- 选 skill / connector 时读 `system_memory`
- 需要参考历史成败时读 `experience_memory`

## 9. 当前结论

**Memory Schema 定义的是 Loop 的连续性数据结构，没有它，记忆脊柱就无法落地。**
