# Workflow Policy

## 1. 核心原则

Loop Engineering 默认先走固定工作流，不默认走全自治 agent。

原因：

- 固定流程更稳定
- 更容易观察状态
- 更容易审查
- 更容易做失败恢复

## 2. 默认顺序

建议默认工作流：

1. intake
2. planning
3. execution
4. review
5. verification
6. completion

## 3. 自治边界

只有在下面条件满足时，才允许提高自治度：

- 任务边界清楚
- 验收标准清楚
- 工具稳定
- 状态追踪已接入
- 失败恢复策略已存在

## 4. 当前结论

**Loop 默认是 workflow-first，不是 autonomy-first。**
