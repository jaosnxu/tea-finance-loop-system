# Loop Runtime

## 1. 定义

`Loop Runtime` 是整个 Loop 系统的执行内核。

它负责：

- 接收目标
- 判断当前状态
- 选择下一步动作
- 调用 skill
- 分配 worktree
- 连接外部能力
- 派生子 agent
- 写回记忆
- 决定继续、切换或结束

一句话：

**Runtime 决定系统每一轮怎么跑。**

## 2. Runtime 输入

每一轮 runtime 至少接收这些输入：

- `goal`
- `constraints`
- `context`
- `available_skills`
- `available_connectors`
- `memory_snapshot`
- `active_worktrees`
- `subagent_status`

## 3. Runtime 输出

每一轮 runtime 的输出必须是明确动作，而不是泛分析。

输出类型包括：

- `call_skill`
- `open_worktree`
- `use_connector`
- `spawn_subagent`
- `write_memory`
- `finish`
- `abort`

## 4. 标准循环

标准循环如下：

1. 读取目标
2. 读取记忆快照
3. 判断当前阶段
4. 选择动作
5. 执行动作
6. 获取反馈
7. 写回记忆
8. 判断是否进入下一轮

压缩表达：

`Goal -> State -> Action -> Feedback -> Memory -> Next Loop`

## 5. 阶段模型

Runtime 必须有阶段概念，否则循环容易失控。

建议标准阶段：

- `intake`
- `planning`
- `execution`
- `verification`
- `repair`
- `complete`
- `blocked`

## 6. 停止规则

Loop 不等于无限循环。

必须定义停止条件：

- 目标达成
- 达到轮数上限
- 连续多轮没有有效进展
- 外部依赖不可用
- 风险超过阈值
- 用户中止

## 7. Runtime 原则

- 目标优先
- 动作必须具体
- 每轮都要有反馈
- 没有反馈就不算完成一轮
- 状态变更必须写回记忆

## 8. 失败定义

Runtime 的失败不是“没成功”这么简单。

失败分成：

- 目标理解失败
- skill 选择失败
- worktree 使用失败
- connector 调用失败
- subagent 协作失败
- 记忆写回失败
- 验证失败

## 9. 最小接口

Runtime 至少要有这几个接口概念：

- `start(goal, context)`
- `step()`
- `apply_feedback(result)`
- `snapshot()`
- `stop(reason)`
