# tea财务管理系统

## 技术栈

- Next.js 15
- TypeScript
- Tailwind CSS
- Prisma
- PostgreSQL
- Auth.js
- next-intl

## 当前阶段

当前已完成第一轮项目骨架搭建，围绕 PRD 中第一优先级主闭环预留了基础页面与数据模型：

- 首页仪表盘
- 付款申请列表页
- 总账页
- 报表中心页
- 系统配置页
- 审批流配置页
- 组织与权限页
- Prisma 基础数据模型

## 下一步

1. 安装依赖
2. 初始化数据库
3. 接登录与权限
4. 实现付款申请创建、审批、付款执行、入账
5. 再补采购、合同、公章与配置驱动能力

## 运行

```bash
npm install
npm run dev
```

## 数据库初始化

默认模式仍然是运行时文件模式：

```bash
TEA_FINANCE_PERSISTENCE_MODE=runtime_json
```

如果要切到数据库模式，先复制环境模板：

```bash
cp .env.example .env
```

然后配置：

- `DATABASE_URL`
- `TEA_FINANCE_PERSISTENCE_MODE=database`

初始化链如下：

```bash
npm run db:doctor
npm run db:generate
npm run db:init
```

说明：

- `db:doctor` 会先检查：
  - `DATABASE_URL`
  - `TEA_FINANCE_PERSISTENCE_MODE`
  - schema 文件
  - 初始 migration 文件
- `db:init` 会先执行 Prisma migration
- 然后执行 `prisma/seed.ts`
- seed 会写入：
  - 付款申请
  - 付款执行
  - 总账分录
  - 系统配置快照
