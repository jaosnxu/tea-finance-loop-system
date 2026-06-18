# Review Gate

## 1. 目的

这份文档定义 reviewer 的放行规则。

## 2. Review Gate 输入

- writer 产出
- 差异说明
- 风险说明
- 当前验收标准

## 3. Review Gate 检查项

- 是否偏离目标
- 是否超出 scope
- 是否引入明显风险
- 是否缺少必要说明
- 是否破坏已有结构

## 4. Review Gate 输出

- `approved`
- `changes_requested`
- `blocked`

## 5. 规则

- writer 不能给自己 review 通过
- review 通过不等于最终完成
- review 通过后还要 verifier 验证

## 6. 当前结论

**Review Gate 负责独立审查，不负责最终验收。**
