# Sub-Agent Protocol

## 1. 目的

这份文档定义主 agent 与子 agent 的交互协议。

## 2. 主 agent 发包格式

```yaml
subagent_id:
goal:
scope:
input_context:
allowed_skills:
allowed_connectors:
worktree_id:
success_criteria:
timebox:
```

## 3. 子 agent 回包格式

```yaml
subagent_id:
status:
summary:
artifacts:
findings:
risks:
next_recommendation:
updated_memory:
```

## 4. 状态值建议

- `running`
- `completed`
- `blocked`
- `failed`
- `aborted`

## 5. 协议原则

- scope 必须小
- 输出必须结构化
- 结果必须可汇总
- 记忆必须回写主系统

## 6. 当前结论

**Sub-Agent Protocol 保证子 agent 不是自由散开，而是可派发、可汇总、可回收。**
