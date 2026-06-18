# Task Record Schema

## 1. 目的

这份文档定义外部任务记录结构。

Loop 不允许只靠对话记忆，必须有外部任务记录。

## 2. 最小结构

```yaml
task_id:
goal:
scope:
acceptance:
status:
current_stage:
owner_runtime:
created_at:
updated_at:
attempt_count:
active_worktrees:
active_subagents:
latest_report:
failure_history:
intent_debt:
artifacts:
```

## 3. 状态建议

- `created`
- `running`
- `blocked`
- `completed`
- `aborted`

## 4. 记录原则

- 每轮更新 `updated_at`
- 每轮写入 `latest_report`
- 失败写入 `failure_history`
- 超过重试上限写入 `intent_debt`

## 5. 当前结论

**Task Record 是 Loop 的外部真相源。**
