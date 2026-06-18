# MCP Connector System

## 1. 定义

`MCP Connector` 是 Loop 系统与外部能力之间的标准接口层。

它负责让系统接触真实世界，而不是只在内部思考。

## 2. Connector 的目标

- 标准化接外部工具
- 降低 skill 与外部平台的耦合
- 让不同项目复用同一套连接方式

## 3. 典型连接对象

- 浏览器
- 文件系统
- GitHub
- Slack
- Notion
- 数据库
- API 服务
- 本地命令系统

## 4. Connector 责任

Connector 负责：

- 建立连接
- 暴露能力
- 返回结果
- 保留调用上下文

Connector 不负责：

- 业务判断
- 最终决策

这些由 Runtime 和 Skill 决定。

## 5. Connector 标准信息

每个 connector 至少应声明：

- `name`
- `target`
- `capabilities`
- `auth_requirements`
- `input_schema`
- `output_schema`
- `error_modes`

## 6. Connector 调用原则

- 能用结构化接口就不用字符串猜测
- 能读真实数据就不凭空想象
- 外部结果必须回写记忆

## 7. Connector 风险

风险主要在：

- 权限过大
- 状态不透明
- 返回格式不稳定
- 外部服务不可用

因此每个 connector 都应标注：

- 是否只读
- 是否会修改外部状态
- 是否高风险

## 8. Connector 与 Skill 的关系

Skill 定义怎么用。

Connector 提供能用什么。

一句话：

**Skill 决定方法，Connector 提供手段。**
