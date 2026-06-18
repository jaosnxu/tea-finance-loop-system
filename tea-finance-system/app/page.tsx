import type { Route } from "next";
import Link from "next/link";

const cards = [
  {
    title: "付款与结算",
    detail: "围绕付款申请、自动入账、执行核对和组织结算形成闭环",
    href: "/dashboard/requests/payments" as Route
  },
  {
    title: "采购与供应链",
    detail: "统一管理采购申请、供应商与付款对象，支撑门店补货和采购流转",
    href: "/dashboard/requests/purchases" as Route
  },
  {
    title: "审批与稽核",
    detail: "统一处理审批待办、OCR异常和合同流转，减少门店与财务卡点",
    href: "/dashboard/approvals" as Route
  },
  {
    title: "组织与权限",
    detail: "统一维护组织主体、门店人员、账号角色和组织访问范围",
    href: "/dashboard/system-center/accounts" as Route
  }
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-paper px-6 py-8 text-ink">
      <div className="mx-auto max-w-6xl">
        <div className="mb-10 flex flex-col gap-4 border-b border-line pb-8">
          <p className="text-sm uppercase tracking-[0.2em] text-bronze">
            tea chain russia
          </p>
          <h1 className="text-4xl font-semibold">茶饮连锁经营系统</h1>
          <p className="max-w-3xl text-base leading-7 text-black/70">
            参考中国头部茶饮连锁后台的经营结构，承载俄罗斯本地组织、税务、结算和核算规则。
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {cards.map((card) => (
            <Link
              key={card.title}
              href={card.href}
              className="rounded-lg border border-line bg-white p-5 transition hover:border-bronze"
            >
              <div className="mb-2 text-lg font-semibold">{card.title}</div>
              <div className="text-sm leading-6 text-black/65">{card.detail}</div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
