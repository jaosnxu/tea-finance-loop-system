# Skill 标准格式

## 1. 目的

这份文档定义 `Loop` 系统里一个 `Skill` 的标准格式。

目标是解决三件事：

- skill 怎么写
- skill 怎么注册
- runtime 怎么调用

如果没有统一格式，skill 就只是零散经验，不能成为系统能力。

## 2. Skill 的最小定义

一个 skill 至少必须有以下字段：

```yaml
name:
purpose:
trigger:
inputs:
outputs:
steps:
constraints:
success_criteria:
failure_signals:
```

这 9 个字段缺一不可。

## 3. 字段说明

### 3.1 `name`

skill 的唯一名字。

要求：

- 全局唯一
- 可读
- 能反映任务类型

例子：

- `prd.parse.v1`
- `frontend.page-build.v1`
- `backend.schema-design.v1`

### 3.2 `purpose`

说明这个 skill 到底是干什么的。

要求：

- 一句话说清核心作用
- 不写模糊描述

坏例子：

- 帮忙处理一下页面

好例子：

- 根据结构化 PRD 输出后台系统页面清单和页面职责

### 3.3 `trigger`

说明什么情况下应当触发这个 skill。

要求：

- 明确触发条件
- 不写成泛泛建议

例子：

- 收到正式 PRD，且目标是从 0 到 1 搭建项目
- 已知业务规则，需要先拆数据库实体

### 3.4 `inputs`

skill 需要哪些输入。

输入必须结构化，至少写清：

- 名称
- 类型
- 是否必填
- 含义

格式示例：

```yaml
inputs:
  - name: prd_text
    type: string
    required: true
    description: 正式 PRD 原文
  - name: constraints
    type: object
    required: false
    description: 技术栈、时间、范围等限制
```

### 3.5 `outputs`

skill 必须交付什么。

输出也必须结构化。

格式示例：

```yaml
outputs:
  - name: module_list
    type: array
    description: 拆出来的模块列表
  - name: page_map
    type: array
    description: 页面结构和页面职责
```

### 3.6 `steps`

skill 的执行步骤。

要求：

- 步骤是离散的
- 顺序明确
- 能直接执行

例子：

1. 阅读输入 PRD
2. 标出核心目标和非目标
3. 提取核心对象
4. 拆分模块
5. 输出页面结构

### 3.7 `constraints`

skill 的限制条件。

例如：

- 不改用户未授权的技术栈
- 不超出当前阶段范围
- 不直接假设不存在的业务规则

### 3.8 `success_criteria`

说明什么叫 skill 成功执行。

要求：

- 可判断
- 可验证

坏例子：

- 感觉差不多

好例子：

- 模块拆分完整覆盖 PRD 范围
- 页面结构与模块一一对应
- 没有把非目标内容纳入第一阶段

### 3.9 `failure_signals`

说明什么叫 skill 失败。

例子：

- 输入缺失
- 结果无法覆盖目标
- 输出结构不完整
- 关键对象遗漏

## 4. Skill 文件建议结构

建议一个 skill 文件采用下面格式：

```yaml
name: prd.parse.v1
purpose: 根据正式 PRD 输出可开发的模块结构
trigger:
  - 收到正式 PRD
  - 需要从业务文档转开发结构
inputs:
  - name: prd_text
    type: string
    required: true
    description: 正式 PRD 全文
outputs:
  - name: modules
    type: array
    description: 模块列表
  - name: entities
    type: array
    description: 实体列表
steps:
  - 阅读 PRD
  - 提取业务目标
  - 提取对象
  - 拆模块
  - 输出结构
constraints:
  - 仅以正式 PRD 为依据
  - 不引入 PRD 没有要求的高阶能力
success_criteria:
  - 模块覆盖完整
  - 对象抽取完整
  - 输出结构可进入下一 skill
failure_signals:
  - 核心对象遗漏
  - 输出无法用于开发
```

## 5. Skill 注册标准

每个 skill 注册时至少应写入系统注册表：

- `name`
- `version`
- `status`
- `owner`
- `domain`
- `input_schema`
- `output_schema`

建议状态：

- `draft`
- `stable`
- `core`

## 6. Skill 调用协议

Runtime 调用 skill 时，应统一传这些内容：

```yaml
skill_name:
goal:
input_payload:
memory_context:
constraints:
expected_output:
```

skill 返回时，应统一回：

```yaml
status:
artifacts:
summary:
next_recommendation:
failure_reason:
```

## 7. Skill 质量标准

一个合格 skill 必须满足：

1. 输入明确
2. 输出明确
3. 步骤明确
4. 成败可判定
5. 可重复调用

如果达不到这五条，它就还不是 skill，只是经验片段。

## 8. Skill 组合标准

多个 skill 串起来时，前一个 skill 的输出必须能成为后一个 skill 的输入。

例如：

`prd.parse -> architecture.split -> schema.design -> ui.build`

这里要求：

- 数据结构能传递
- 阶段边界清楚
- 不依赖隐含脑补

## 9. 当前结论

统一一句话：

**Skill 不是提示词，而是带有固定输入、固定输出、固定步骤、固定成功标准的可复用能力单元。**
