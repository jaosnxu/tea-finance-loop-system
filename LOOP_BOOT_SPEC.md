# Loop Boot Spec

## 1. 目的

这份文档定义 `Loop` 系统如何正式启动一次任务。

启动不是一句“开始”，而是一次标准初始化。

## 2. 启动包

每次启动至少要提供：

```yaml
goal:
scope:
acceptance:
environment:
policy:
memory:
```

## 3. 字段说明

### `goal`

要完成的目标。

### `scope`

允许处理的范围，以及明确禁止的范围。

### `acceptance`

验收标准。没有验收标准，runtime 不能判断是否完成。

### `environment`

任务运行环境，例如：

- repo_path
- available_connectors
- worktree_mode
- auth_state
- project_root
- project_memory_index_path
- require_project_memory_index
- test_setup_command
- test_command

当任务针对具体业务项目时，必须提供 `project_root`。Loop 会读取目标项目的 `docs/loop/00_MEMORY_INDEX.md`，并把该索引列出的项目宪法、技术标准、业务计划、测试标准和最近日志装入 runtime memory。

如果 `require_project_memory_index=true`，目标项目缺少 memory index 时启动必须失败，不能退回到对话记忆或人工脑内判断。

当任务需要在隔离 worktree 运行测试时，可以提供 `test_setup_command`。Loop 必须先执行 setup，再执行 `test_command`，并把 setup 结果和 CI 结果分别写入外部任务记录。

### `policy`

运行策略，例如：

- workflow mode
- retry limit
- self repair limit
- reviewer required
- verifier required
- allow subagents

失败处理规则：

- `network_error` / `timeout`：自动 retry，不找用户确认
- `code_error`：进入 self-repair cycle，回到 planning 重新规划、路由、执行和验证
- `permission_error` / `auth_error` / `configuration_error` / `requirement_ambiguity`：记录阻塞，不继续乱跑
- `production_risk`：立即停止并归档 intent debt

超过 `retry_limit` 或 `self_repair_limit` 后，Loop 必须把问题写入 intent debt，并创建 repair queue item，不能无限循环。

默认循环预算：

- `retry_limit`: 3
- `self_repair_limit`: 3
- 单个 connector 必须有 `connector_timeout_seconds`
- 长任务必须持续写 heartbeat

Self-repair cycle 必须做完整闭环：

1. 读取 failure history、run summary 和 repository memory
2. 重新生成 issue plan
3. 重新路由 skills、connectors、subagents
4. 在隔离 worktree 执行
5. 重新运行 review、verification、merge gate
6. 成功则完成；失败则进入下一轮 self-repair
7. 超过预算后写 intent debt 和 regression candidate
8. 同时写入 `repair_queue.jsonl`，下次启动可从队列恢复

Loop 不能因为代码失败马上问人；只有权限、认证、生产风险、需求不清、配置缺失才允许阻塞等待人处理。

Intent debt 不是终点。它必须带有恢复计划：

- `code_error`：进入 `automated_repair` 队列，下一轮拆小范围、升级工具、从 planning 恢复
- `network_error` / `timeout`：进入 delayed retry 队列，按 backoff 再启动
- `permission_error` / `auth_error` / `configuration_error`：进入 human-blocked 队列，外部条件恢复后继续
- `production_risk`：进入 approval-required 队列，必须显式批准后继续

Repair queue 是可恢复状态机，不是普通日志：

- `open`：等待下一轮 Loop 处理
- `claimed`：已被某个 worker task 认领，避免重复处理
- `resolved`：恢复任务完成，原问题关闭
- `failed`：恢复任务失败，必须产生新的 intent debt / repair queue item

自动启动只允许认领 `automated_repair` 和 `delayed_retry`。`human_blocked` 和 `approval_required` 只能在权限、配置、需求或生产批准恢复后由明确启动包恢复。

### `memory`

任务记录位置，例如：

- task_id
- record_path
- memory_namespace

## 4. 启动顺序

标准启动顺序：

1. 校验启动包完整性
2. 创建 task record
3. 初始化 task memory
4. 装载可用 skill
5. 装载可用 connector
6. 创建 primary worktree
7. 把 goal 交给 runtime
8. 进入第一轮 `intake`

## 5. 标准运行记录

每次 Loop 运行必须写外部记录，不能依赖对话记忆。

标准文件包括：

- `task_record.json`：完整任务状态
- `reports.jsonl`：每个阶段的短报告
- `trace.jsonl`：每个阶段的运行事件
- `run_report.json`：机器可读的运行摘要
- `run_summary.json`：复盘和经验回用摘要

如果启动包配置了 repository memory，Loop 还必须把 `run_summary` 归档到：

- `memory/runs/<task_id>.json`
- `memory/run_history.jsonl`

`run_summary` 至少包含目标、范围、验收标准、读取的项目 memory index、阶段状态、gate 状态、失败记录、intent debt、验证结果和下一步建议。

## 6. 启动失败

以下情况不应启动：

- goal 缺失
- acceptance 缺失
- scope 缺失
- 环境无法访问
- 关键 connector 不可用

## 7. 当前结论

**Loop Boot Spec 定义的是“如何合法启动一次 Loop 任务”。**
