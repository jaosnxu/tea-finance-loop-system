# Worktree System

## 1. 定义

`Worktree` 是 Loop 系统的隔离执行层。

它的作用不是存文件这么简单，而是保证：

- 每个任务有独立现场
- 每次尝试互不污染
- 并行方案互不覆盖
- 主项目上下文可回到稳定状态

## 2. Worktree 的对象

每个 worktree 应该绑定：

- 一个目标
- 一个任务 id
- 一个执行上下文
- 一组文件状态
- 一组变更记录

## 3. Worktree 类型

至少应区分三种：

1. `primary_worktree`
   主工作区

2. `task_worktree`
   单个任务专属工作区

3. `branch_worktree`
   用于并行试验不同方案

## 4. Worktree 生命周期

标准生命周期：

1. 创建
2. 装载上下文
3. 执行修改
4. 记录差异
5. 验证
6. 合并或丢弃

## 5. Worktree 规则

- 一个 worktree 只服务一个当前任务
- 多方案必须分 worktree
- 验证失败默认不直接污染主工作区
- 每轮变更都应可追溯

## 6. Worktree 输出

每个 worktree 应能输出：

- 当前状态
- 文件变更
- 验证结果
- 与上轮差异
- 合并建议

## 7. Worktree 与 Runtime 的关系

Runtime 决定什么时候开 worktree。

Worktree 负责：

- 接住执行动作
- 返回实际产出
- 保持隔离性

## 8. 适用场景

- 代码项目开发
- 多方案前端页面实验
- 大型文档重写
- 风险较高的自动修复
- 多 agent 协作
