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
- reviewer required
- verifier required
- allow subagents

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

## 5. 启动失败

以下情况不应启动：

- goal 缺失
- acceptance 缺失
- scope 缺失
- 环境无法访问
- 关键 connector 不可用

## 6. 当前结论

**Loop Boot Spec 定义的是“如何合法启动一次 Loop 任务”。**
