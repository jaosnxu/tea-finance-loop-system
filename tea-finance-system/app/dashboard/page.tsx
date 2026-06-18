import { unstable_noStore as noStore } from "next/cache";
import Link from "next/link";
import type { Route } from "next";
import {
  ArrowRight,
  BarChart3,
  Building2,
  FileClock,
  Landmark,
  ShieldAlert
} from "lucide-react";

import { requirePageAccess } from "@/lib/auth";
import { getRoleDashboardView } from "@/lib/demo-store";

export default async function DashboardPage() {
  noStore();
  const session = await requirePageAccess("dashboard");
  const view = await getRoleDashboardView(session.role);
  const focusItems = buildFocusItems(view.stats);
  const quickLinks: Array<{
    href: Route;
    label: string;
    note: string;
    icon: typeof FileClock;
  }> = [
    {
      href: "/dashboard/approvals",
      label: "审批中心",
      note: "处理待办、异常和稽核事项",
      icon: FileClock
    },
    {
      href: "/dashboard/requests/payments",
      label: "付款申请",
      note: "发起、跟踪和核对付款单据",
      icon: Landmark
    },
    {
      href: "/dashboard/execution",
      label: "付款执行",
      note: "登记付款、核对流水和执行结果",
      icon: ShieldAlert
    },
    {
      href: "/dashboard/reports",
      label: "经营报表",
      note: "看组织汇总、自动入账和经营口径",
      icon: BarChart3
    }
  ];

  return (
    <main className="space-y-6">
      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(280px,0.95fr)]">
        <header className="overflow-hidden rounded-[28px] border border-line bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-full bg-bronze/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-bronze">
              经营驾驶舱
            </div>
            <div className="rounded-full border border-line px-3 py-1 text-sm text-black/65">
              当前岗位：<span className="font-semibold text-ink">{getRoleLabel(session.role)}</span>
            </div>
          </div>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            {view.title}
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-black/65 sm:text-[15px]">
            {view.description}
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-paper px-4 py-4">
              <div className="text-xs uppercase tracking-[0.14em] text-black/45">首要目标</div>
              <div className="mt-2 text-sm font-medium text-ink">把待办、异常、资金和报表放到同一屏决策</div>
            </div>
            <div className="rounded-2xl bg-paper px-4 py-4">
              <div className="text-xs uppercase tracking-[0.14em] text-black/45">今日动作</div>
              <div className="mt-2 text-sm font-medium text-ink">优先处理异常与待核对，再看自动入账结果</div>
            </div>
            <div className="rounded-2xl bg-paper px-4 py-4">
              <div className="text-xs uppercase tracking-[0.14em] text-black/45">经营视角</div>
              <div className="mt-2 flex items-center gap-2 text-sm font-medium text-ink">
                <Building2 className="h-4 w-4 text-bronze" />
                聚焦集团资金与组织范围
              </div>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/dashboard/reports"
              className="inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90"
            >
              查看经营报表
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/dashboard/approvals"
              className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-4 py-2.5 text-sm font-medium text-ink transition hover:bg-paper"
            >
              进入审批中心
            </Link>
          </div>
        </header>

        <aside className="rounded-[28px] border border-line bg-white p-6 shadow-sm">
          <div className="text-sm uppercase tracking-[0.18em] text-bronze">今日关注</div>
          <div className="mt-4 space-y-3">
            {focusItems.map((item) => (
              <div key={item.title} className="rounded-2xl border border-line bg-paper px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-ink">{item.title}</div>
                    <div className="mt-1 text-sm text-black/55">{item.description}</div>
                  </div>
                  <span className={item.badgeClass}>{item.badge}</span>
                </div>
              </div>
            ))}
          </div>
        </aside>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-12">
        {view.stats.map((stat, index) => (
          <div
            key={stat.label}
            className={[
              "rounded-[24px] border border-line bg-white p-5 shadow-sm",
              index === 0 ? "xl:col-span-5" : "xl:col-span-3"
            ].join(" ")}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="text-sm text-black/55">{stat.label}</div>
              <span className="rounded-full bg-paper px-2.5 py-1 text-[11px] font-medium text-black/55">
                {stat.note}
              </span>
            </div>
            <div className={index === 0 ? "mt-6 text-4xl font-semibold tracking-tight" : "mt-6 text-3xl font-semibold tracking-tight"}>
              {stat.value}
            </div>
            <div className="mt-3 h-1.5 w-16 rounded-full bg-bronze/20">
              <div className={index === 0 ? "h-full w-full rounded-full bg-bronze" : "h-full w-3/5 rounded-full bg-moss"} />
            </div>
          </div>
        ))}
      </section>

      <section className="rounded-[28px] border border-line bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-lg font-semibold">常用入口</div>
            <div className="mt-1 text-sm text-black/55">把高频操作做成老板和财务都能一眼进入的任务入口。</div>
          </div>
          <div className="text-sm text-black/45">4 个核心路径，避免首屏过度分散注意力</div>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {quickLinks.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="group rounded-[22px] border border-line bg-paper px-4 py-4 text-sm transition hover:-translate-y-0.5 hover:bg-white hover:shadow-sm"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-bronze shadow-sm">
                    <Icon className="h-5 w-5" />
                  </div>
                  <ArrowRight className="h-4 w-4 text-black/30 transition group-hover:translate-x-1 group-hover:text-ink" />
                </div>
                <div className="mt-4 font-medium text-ink">{item.label}</div>
                <div className="mt-1 text-black/55">{item.note}</div>
              </Link>
            );
          })}
        </div>
      </section>
    </main>
  );
}

function buildFocusItems(stats: Array<{ label: string; value: string; note: string }>) {
  const getValue = (label: string) => stats.find((stat) => stat.label === label)?.value ?? "0";
  const pendingReview = getValue("已付款待核对");
  const executionIssues = getValue("执行异常");
  const autoPosted = getValue("已自动入账单据");

  return [
    {
      title: "异常与待核对优先",
      description: `当前待核对 ${pendingReview} 笔，执行异常 ${executionIssues} 笔，建议先处理风险项。`,
      badge: executionIssues === "0" ? "低风险" : "需处理",
      badgeClass:
        executionIssues === "0"
          ? "rounded-full bg-moss/15 px-2.5 py-1 text-xs font-semibold text-moss"
          : "rounded-full bg-rose px-2.5 py-1 text-xs font-semibold text-bronze"
    },
    {
      title: "自动入账结果可追踪",
      description: `已自动入账 ${autoPosted} 笔，首屏应能直接进入总账与报表复核。`,
      badge: "看沉淀",
      badgeClass: "rounded-full bg-bronze/10 px-2.5 py-1 text-xs font-semibold text-bronze"
    },
    {
      title: "首屏继续补强趋势信息",
      description: "下一步建议加入昨日对比、组织排名和资金变化趋势，减少纯静态数字。",
      badge: "待升级",
      badgeClass: "rounded-full bg-paper px-2.5 py-1 text-xs font-semibold text-black/55"
    }
  ];
}

function getRoleLabel(role: string) {
  return {
    boss: "老板",
    finance: "财务",
    cashier: "出纳",
    applicant: "申请人"
  }[role] ?? role;
}
