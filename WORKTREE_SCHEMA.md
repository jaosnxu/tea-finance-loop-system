# Worktree Schema

## 1. 目的

这份文档定义 worktree 的结构化对象。

## 2. 最小结构

```yaml
worktree_id:
task_id:
parent_worktree:
type:
goal:
scope:
base_snapshot:
current_snapshot:
changed_files:
verification_status:
owner:
created_at:
updated_at:
status:
```

## 3. 字段说明

- `type`
  建议值：`primary` / `task` / `branch`

- `base_snapshot`
  创建时的基线状态

- `current_snapshot`
  当前执行后的状态

- `verification_status`
  建议值：`pending` / `passed` / `failed`

- `status`
  建议值：`active` / `merged` / `discarded`

## 4. 生命周期事件

每个 worktree 至少应记录：

- `created`
- `executed`
- `verified`
- `merged`
- `discarded`

## 5. 当前结论

**Worktree Schema 负责把“隔离工作区”变成系统能追踪、能比较、能合并的执行对象。**
