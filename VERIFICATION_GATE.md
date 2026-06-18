# Verification Gate

## 1. 目的

这份文档定义 verifier 的验证放行规则。

## 2. 验证输入

- 审查通过的产出
- 测试结果
- CI 结果
- 验收标准

## 3. 验证检查项

- 是否满足 acceptance
- 测试是否通过
- CI 是否通过
- 是否存在阻断性错误

## 4. 输出状态

- `verified`
- `failed`
- `blocked`

## 5. 当前结论

**Verification Gate 决定结果是否真正过关。**
