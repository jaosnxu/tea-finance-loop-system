# Connector Registry

## 1. 目的

`Connector Registry` 是 MCP / 外部连接器的注册与索引中心。

它负责：

- 记录有哪些连接器
- 每个连接器能做什么
- 哪些是只读，哪些会改外部状态
- runtime 如何按任务挑选连接器

## 2. 最小字段

```yaml
name:
version:
status:
target:
capabilities:
risk_level:
mode:
auth_requirements:
entry:
input_schema:
output_schema:
priority:
```

## 3. 关键字段说明

- `target`
  连接对象，例如 `github`、`browser`、`database`

- `capabilities`
  能力列表，例如 `read_file`、`create_pr`、`query_rows`

- `risk_level`
  建议用：`low` / `medium` / `high`

- `mode`
  建议用：`read_only` / `read_write`

## 4. Runtime 选择规则

选择连接器时至少考虑：

- 当前任务是否需要外部真实信息
- 是否需要修改外部状态
- 风险等级是否允许
- 该连接器是否处于 `stable/core`

## 5. 当前结论

**Connector Registry 让外部能力从“能不能接”变成“系统如何标准化选择和治理”。**
