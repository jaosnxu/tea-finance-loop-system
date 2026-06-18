# CI And Release Policy

## 1. 原则

自动合并前必须经过：

- CI
- tests
- review gate
- verification gate

## 2. 最小要求

- 构建通过
- 关键测试通过
- reviewer 放行
- verifier 放行

## 3. 发布后要求

发布后必须执行 smoke test。

如果 smoke test 失败：

- 不能标记成功
- 自动创建修复任务

## 4. 当前结论

**CI 和 release policy 负责把开发闭环接到交付闭环。**
