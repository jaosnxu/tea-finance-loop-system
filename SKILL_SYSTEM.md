# Skill System

## 1. 定义

`Skill` 是 Loop 系统中的可复用能力单元。

Skill 不是一句提示词，也不是一次性脚本。

Skill 是：

- 固定任务类型
- 固定输入输出
- 固定执行步骤
- 可重复调用

## 2. Skill 的作用

Skill 负责把“临时会做”变成“系统稳定会做”。

它解决的是：

- 同类任务反复重想
- 经验无法沉淀
- 任务方式不统一

## 3. Skill 标准结构

一个完整 skill 应至少包含：

- `name`
- `purpose`
- `trigger`
- `inputs`
- `outputs`
- `steps`
- `constraints`
- `success_criteria`
- `failure_signals`

## 4. Skill 分类

建议按四类管理：

1. `analysis_skills`
   例如 PRD 解析、代码审阅、问题诊断

2. `build_skills`
   例如页面搭建、API 开发、数据建模

3. `repair_skills`
   例如构建失败修复、测试失败修复、类型错误修复

4. `operation_skills`
   例如部署、连接器配置、数据导入

## 5. Skill 调用规则

Runtime 调用 skill 时必须明确：

- 为什么调用
- 输入是什么
- 预期输出是什么
- 成功判定是什么

## 6. Skill 的输入输出原则

- 输入必须结构化
- 输出必须可验证
- 不能只输出模糊建议

例如：

- 坏 skill：`帮我想一下怎么改`
- 好 skill：`根据 PRD 输出页面清单和模块拆分`

## 7. Skill 组合

复杂任务不能只靠一个 skill。

应支持 skill 链：

`解析 -> 规划 -> 实现 -> 验证 -> 修复`

## 8. Skill 版本化

Skill 必须支持版本概念。

因为：

- 规则会进化
- 成功路径会变化
- 某些旧 skill 会失效

## 9. Skill 存储

Skill 可以由文档、模板、脚本、规则文件组成。

关键不在形式，而在是否具备：

- 可触发
- 可执行
- 可验证
- 可复用

## 10. Skill 成熟度

建议分三级：

- `draft`
- `stable`
- `core`

`core` 表示系统高频复用、结果稳定的 skill。
