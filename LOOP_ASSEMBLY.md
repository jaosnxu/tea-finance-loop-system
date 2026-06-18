# Loop 总装配说明

## 1. 总图

Loop 系统由六部分组成：

- Runtime
- Worktree
- Skill
- MCP Connector
- Sub-Agent
- Memory Spine

## 2. 装配关系

### Runtime

作为中枢，负责调度其他五部分。

### Worktree

作为执行现场，为 Runtime 和 Sub-Agent 提供隔离空间。

### Skill

作为方法库，为 Runtime 和 Sub-Agent 提供可复用能力。

### MCP Connector

作为外部接口层，为 Runtime、Skill、Sub-Agent 提供真实工具访问。

### Sub-Agent

作为任务分身层，为复杂目标提供并行推进能力。

### Memory Spine

作为统一主干，把以上所有状态和经验串起来。

## 3. 标准装配流程

1. 注册 skill
2. 注册 connector
3. 初始化 memory spine
4. 启动 runtime
5. runtime 读取 goal
6. runtime 决定是否开 worktree
7. runtime 决定是否调用 skill
8. runtime 决定是否启用 connector
9. runtime 决定是否派生子 agent
10. 所有结果回写 memory
11. 进入下一轮

## 4. 一句话装配关系

`Runtime` 驱动全局，`Worktree` 隔离现场，`Skill` 提供方法，`Connector` 接外部能力，`Sub-Agent` 并行拆解任务，`Memory Spine` 维持连续性。

## 5. 系统完整性的判断标准

如果只有循环，没有：

- skill
- worktree
- connector
- sub-agent
- memory spine

那它只是 agent workflow，不是完整 Loop 系统。
