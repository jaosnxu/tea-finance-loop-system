# Skill Registry

## 1. 目的

`Skill Registry` 是 Loop 系统里的 skill 注册中心。

它解决的问题不是“skill 怎么写”，而是：

- skill 写好以后放哪里
- runtime 怎么找到它
- 多个 skill 怎么区分版本
- 哪些 skill 可用，哪些 skill 废弃

一句话：

**Skill Spec 负责定义 skill 长什么样，Skill Registry 负责管理这些 skill。**

## 2. Registry 的职责

注册中心至少负责：

- 注册 skill
- 维护 skill 元信息
- 暴露可查询索引
- 维护版本状态
- 提供启用/禁用标记
- 提供按任务类型查找能力

## 3. Registry 的最小字段

每个 skill 在 registry 中至少需要这些字段：

```yaml
name:
version:
status:
domain:
tags:
owner:
entry:
input_schema:
output_schema:
trigger_summary:
priority:
```

## 4. 字段说明

### 4.1 `name`

skill 的唯一业务名。

例子：

- `prd.parse`
- `backend.schema-design`
- `frontend.page-build`

### 4.2 `version`

skill 版本号。

建议：

- `v1`
- `v2`
- `v3`

不要把版本写进描述文字里。

### 4.3 `status`

skill 当前状态。

建议统一用：

- `draft`
- `stable`
- `core`
- `deprecated`
- `disabled`

含义：

- `draft`：可试用，但不稳定
- `stable`：可正式使用
- `core`：高频主干 skill
- `deprecated`：旧版，尽量不用
- `disabled`：当前不可调用

### 4.4 `domain`

skill 所属领域。

例子：

- `analysis`
- `frontend`
- `backend`
- `data`
- `operations`

### 4.5 `tags`

用于检索和路由。

例子：

- `prd`
- `approval`
- `finance`
- `ui`
- `schema`

### 4.6 `owner`

谁维护这个 skill。

可以是：

- 系统核心
- 某个团队
- 某个项目族

### 4.7 `entry`

skill 的入口位置。

可能是：

- 文档路径
- 配置文件路径
- 可执行脚本路径

### 4.8 `input_schema`

输入结构定义引用。

### 4.9 `output_schema`

输出结构定义引用。

### 4.10 `trigger_summary`

一句话写清触发条件。

### 4.11 `priority`

当多个 skill 都可用时，runtime 怎么排序。

建议：

- 数字越小优先级越高

## 5. 建议的数据结构

可以先用这种结构：

```yaml
skills:
  - name: prd.parse
    version: v1
    status: core
    domain: analysis
    tags: [prd, planning, architecture]
    owner: system
    entry: skills/prd.parse.v1.yaml
    input_schema: schemas/prd.parse.input.json
    output_schema: schemas/prd.parse.output.json
    trigger_summary: 收到正式 PRD 且需要转开发结构时调用
    priority: 10
```

## 6. Registry 支持的查询方式

至少支持 5 种查询：

1. 按 `name`
2. 按 `domain`
3. 按 `status`
4. 按 `tags`
5. 按 `trigger_summary` / 任务类型

## 7. Runtime 如何使用 Registry

runtime 每轮 routing 时，最少做这几步：

1. 根据当前任务判断 domain
2. 根据目标和上下文匹配 tags
3. 从 registry 里找 `status=stable/core` 的 skill
4. 按 priority 排序
5. 选择最适合的 skill

如果找不到：

- 返回 `no_skill_match`
- 进入 planning 或 blocked

## 8. Skill 版本规则

同一个 skill 允许多个版本并存：

- `prd.parse.v1`
- `prd.parse.v2`

但 registry 里必须明确：

- 当前默认版本
- 哪个版本废弃
- 哪个版本仅限回滚兼容

## 9. 启用与禁用规则

某个 skill 即使存在，也不一定可调用。

registry 必须能区分：

- 存在
- 可见
- 可调用

例如：

- `deprecated`：仍可见，但不推荐
- `disabled`：存在，但 runtime 不应调用

## 10. 项目无关原则

registry 不应该被某个项目绑死。

项目只是输入上下文。

registry 里保存的是：

- 通用 skill
- 某类项目可复用 skill
- 某个领域的 skill 族

这正是 Loop 系统可复用的关键。

## 11. 最小接口建议

注册中心至少应对 runtime 暴露：

- `register(skill_meta)`
- `find_by_name(name)`
- `find_by_domain(domain)`
- `search(tags, context)`
- `list_active()`
- `disable(name, version)`
- `deprecate(name, version)`

## 12. Registry 与 Skill Spec 的关系

两者分工必须清楚：

- `Skill Spec`
  规定 skill 的内容结构

- `Skill Registry`
  管理 skill 的生命周期和索引

## 13. 当前结论

统一一句话：

**Skill Registry 是 Loop 系统的 skill 索引层，它让 skill 从“散落文档”变成“runtime 可发现、可选择、可治理的系统资源”。**
