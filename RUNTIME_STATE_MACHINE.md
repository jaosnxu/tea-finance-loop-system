# Runtime 状态机

## 1. 目的

这份文档定义 `Loop Runtime` 的状态机。

目标是解决：

- runtime 一轮一轮怎么切换
- 什么情况下该调用 skill
- 什么情况下该开 worktree
- 什么情况下该派子 agent
- 什么情况下该停

如果没有状态机，runtime 就只是在“反复做事”，不是可实现系统。

## 2. 核心状态

建议 runtime 至少有 8 个状态：

1. `intake`
2. `understanding`
3. `planning`
4. `routing`
5. `executing`
6. `verifying`
7. `repairing`
8. `completed`

另加两个异常状态：

9. `blocked`
10. `aborted`

## 3. 状态定义

### 3.1 `intake`

负责接收任务。

输入：

- goal
- constraints
- context

输出：

- 初始任务对象

进入下一状态条件：

- 目标和约束已接收

下一状态：

- `understanding`

### 3.2 `understanding`

负责理解任务。

动作：

- 解析目标
- 提取约束
- 判断任务类型
- 读取相关记忆

输出：

- task_model

进入下一状态条件：

- 已能清楚描述目标、范围、限制

下一状态：

- `planning`
- 或 `blocked`

### 3.3 `planning`

负责决定完成任务需要哪些阶段。

动作：

- 切分子目标
- 估算复杂度
- 判断是否需要 skill 链

输出：

- execution_plan

下一状态：

- `routing`

### 3.4 `routing`

负责分配资源。

动作：

- 选择 skill
- 选择 connector
- 判断是否需要新 worktree
- 判断是否需要子 agent

输出：

- route_decision

下一状态：

- `executing`

### 3.5 `executing`

负责真正执行动作。

动作包括：

- 调 skill
- 开 worktree
- 调 connector
- 派子 agent
- 直接执行本轮任务

输出：

- execution_result

下一状态：

- `verifying`

### 3.6 `verifying`

负责判断这一轮是否真的有效。

动作：

- 检查输出是否符合目标
- 检查是否有新增问题
- 比较这一轮前后状态

输出：

- verification_result

下一状态：

- `completed`
- `repairing`
- `planning`
- `blocked`

### 3.7 `repairing`

负责处理失败或偏差。

动作：

- 判断失败类型
- 选择修复策略
- 决定是否重试
- 决定是否换 skill
- 决定是否新开 worktree

输出：

- repair_plan

下一状态：

- `routing`
- `blocked`
- `aborted`

### 3.8 `completed`

说明目标已达成。

动作：

- 写总结
- 写记忆
- 输出结果

### 3.9 `blocked`

说明当前任务无法继续推进，但不是用户主动终止。

典型原因：

- 输入缺失
- 外部能力不可用
- 决策条件不足

### 3.10 `aborted`

说明任务被主动停止。

典型原因：

- 用户中断
- 风险超标
- 停止规则触发

## 4. 主状态迁移图

```text
intake
  -> understanding
  -> planning
  -> routing
  -> executing
  -> verifying

verifying
  -> completed
  -> repairing
  -> planning
  -> blocked

repairing
  -> routing
  -> blocked
  -> aborted
```

## 5. 关键决策点

### 5.1 什么时候调用 skill

满足任一条件即可：

- 任务类型已有成熟方法
- 需要结构化输出
- 需要固定执行步骤

### 5.2 什么时候开 worktree

满足任一条件即可：

- 涉及文件改动
- 需要并行试方案
- 需要隔离执行现场

### 5.3 什么时候用 connector

满足任一条件即可：

- 需要外部真实信息
- 需要访问系统外工具
- 需要修改外部状态

### 5.4 什么时候派子 agent

满足任一条件即可：

- 任务天然可拆
- 单线程推进过慢
- 需要并行探索多个方向

## 6. 验证规则

每轮 `executing` 后都必须 `verifying`。

不能直接从执行跳到下一轮执行。

因为没有验证，就不知道：

- 是不是更接近目标
- 是不是引入了新问题
- 是不是该换策略

## 7. Repair 分流规则

失败后至少区分五类：

- `understanding_failure`
- `planning_failure`
- `skill_failure`
- `connector_failure`
- `execution_failure`

不同失败要走不同修复路线。

## 8. Memory 写入时点

状态机中至少四个时点必须写记忆：

1. `understanding` 完成后
2. `routing` 决策后
3. `verifying` 完成后
4. `completed / blocked / aborted` 收尾时

## 9. Runtime 最小伪流程

```text
receive goal
-> intake
-> understanding
-> planning
-> routing
-> executing
-> verifying

if success:
  -> completed
else:
  -> repairing
  -> routing
  -> executing
  -> verifying
```

## 10. 当前结论

统一一句话：

**Runtime 不是 while loop，而是带状态切换、资源分配、执行验证、修复分流的任务状态机。**
