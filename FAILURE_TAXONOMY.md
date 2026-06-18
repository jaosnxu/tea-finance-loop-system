# Failure Taxonomy

## 1. 目的

失败必须分类，否则系统无法做正确恢复。

## 2. 建议分类

- `network_error`
- `permission_error`
- `auth_error`
- `configuration_error`
- `code_error`
- `requirement_ambiguity`
- `production_risk`
- `timeout`
- `unknown`

## 3. 分类后的默认动作

- `network_error`
  自动重试

- `permission_error`
  进入 blocked

- `auth_error`
  进入 blocked

- `configuration_error`
  进入 blocked

- `code_error`
  进入 repair

- `requirement_ambiguity`
  进入 blocked

- `production_risk`
  停止并升级

- `timeout`
  允许有限重试

- `unknown`
  进入人工审查或 reviewer 分流

## 4. 当前结论

**失败分类决定恢复路径。**
