# Heartbeat And Timeout Policy

## 1. 目的

长任务必须有心跳，每个步骤必须有超时。

否则系统分不清：

- 还在跑
- 卡住了
- 死掉了

## 2. Heartbeat 规则

长任务应定期报告：

- 当前步骤
- 最后进展时间
- 当前阻塞点

## 3. Timeout 规则

每个步骤都必须定义超时。

超时后默认动作：

- 标记 `timeout`
- 写失败记录
- 走 retry 或 blocked 分流

## 4. 卡死判定

如果长时间没有心跳：

- 自动判定 stuck
- 转 blocked 或 repair

## 5. 当前结论

**Heartbeat 解决“有没有活着”，Timeout 解决“该不该继续等”。**
