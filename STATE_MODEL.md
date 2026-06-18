# State Model

## 1. 目的

所有步骤必须状态化。

没有状态，系统就无法判断：

- 当前卡在哪
- 是否需要重试
- 是否已经完成

## 2. 最小状态集合

每个步骤至少应有：

- `pending`
- `running`
- `failed`
- `retrying`
- `blocked`
- `done`

## 3. 状态切换原则

- `pending -> running`
- `running -> done`
- `running -> failed`
- `failed -> retrying`
- `retrying -> running`
- `failed -> blocked`

## 4. 状态持久化

每次状态变更都必须写到外部记录层。

不能只留在上下文里。

## 5. 当前结论

**状态模型是 Loop 运行纪律的第一基础。**
