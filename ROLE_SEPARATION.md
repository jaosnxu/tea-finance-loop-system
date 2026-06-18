# Role Separation

## 1. 原则

writer / reviewer / verifier 必须分离。

## 2. 三个角色

### writer

负责产出改动：

- 写代码
- 改配置
- 改文档

### reviewer

负责独立审查：

- 有没有逻辑问题
- 有没有风险
- 有没有偏离目标

### verifier

负责验证：

- 测试是否通过
- CI 是否通过
- 结果是否符合验收标准

## 3. 禁止事项

- writer 不能自己给自己放行
- reviewer 不能代替 verifier
- verifier 不能跳过标准直接认定成功

## 4. 当前结论

**角色分离是 Loop 防止自证正确的核心纪律。**
