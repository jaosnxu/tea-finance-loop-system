import { unstable_noStore as noStore } from "next/cache";
import Link from "next/link";
import type { Route } from "next";

import { requirePageAccess } from "@/lib/auth";
import {
  formatMoney,
  getExecutionWorkbenchRows,
  getExecutionWorkbenchSummary,
  getOrganizationConfigViewAsync,
  getStatusTone,
  paymentStatusLabels
} from "@/lib/demo-store";

const statusOptions = [
  { key: "all", label: "全部" },
  { key: "approved_waiting_payment", label: "待付款" },
  { key: "partially_paid", label: "部分付款" },
  { key: "paid", label: "已付款" }
] as const;

const currencyOptions = [
  { key: "all", label: "全部币种" },
  { key: "RUB", label: "RUB" },
  { key: "CNY", label: "CNY" },
  { key: "USD", label: "USD" }
] as const;

type ExecutionPageProps = {
  searchParams?: Promise<{
    organization?: string;
    status?: string;
    currency?: string;
  }>;
};

export default async function ExecutionPage({ searchParams }: ExecutionPageProps) {
  noStore();
  await requirePageAccess("payment_execution");
  const params = (await searchParams) ?? {};
  const organization = params.organization ?? "all";
  const status = statusOptions.some((item) => item.key === params.status) ? params.status! : "all";
  const currency = currencyOptions.some((item) => item.key === params.currency) ? params.currency! : "all";

  const [summary, rows, organizations] = await Promise.all([
    getExecutionWorkbenchSummary({ organization, currency: currency as "RUB" | "CNY" | "USD" | "all" }),
    getExecutionWorkbenchRows({
      organization,
      status: status as "approved_waiting_payment" | "partially_paid" | "paid" | "all",
      currency: currency as "RUB" | "CNY" | "USD" | "all"
    }),
    getOrganizationConfigViewAsync()
  ]);
  const activeOrganizations = organizations.filter((item) => item.isActive);

  return (
    <main className="space-y-6">
      <header className="rounded-lg border border-line bg-white p-6">
        <div className="text-sm uppercase tracking-[0.18em] text-bronze">cash execution</div>
        <h1 className="mt-2 text-3xl font-semibold">资金执行与核对</h1>
        <p className="mt-3 max-w-4xl text-sm leading-6 text-black/65">
          审批通过后的单据统一进入这里。这里只做付款登记、流水核对和异常跟进。
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        {[
          { label: "待付款", value: summary.awaitingPayment },
          { label: "部分付款", value: summary.partialPayment },
          { label: "待核对", value: summary.pendingVerification },
          { label: "已核对", value: summary.verifiedCompleted },
          { label: "未付余额", value: formatMoney(summary.unpaidBalance, "RUB") },
          { label: "已执行金额", value: formatMoney(summary.executedAmount, "RUB") },
          { label: "异常待跟进", value: summary.exceptionCount }
        ].map((item) => (
          <div key={item.label} className="rounded-lg border border-line bg-white p-5">
            <div className="text-sm text-black/55">{item.label}</div>
            <div className="mt-3 text-2xl font-semibold">{item.value}</div>
          </div>
        ))}
      </section>

      <section className="rounded-lg border border-line bg-white p-6">
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <div className="text-sm font-medium text-black/70">组织范围</div>
            <div className="mt-2 flex flex-wrap gap-2">
              <Link
                href={`/dashboard/execution?organization=all&status=${status}&currency=${currency}` as Route}
                className={`rounded-md px-3 py-2 text-sm ${organization === "all" ? "bg-ink text-white" : "border border-line bg-paper text-ink"}`}
              >
                全部组织
              </Link>
              {activeOrganizations.map((item) => {
                const active = organization === item.displayName;
                return (
                  <Link
                    key={item.id}
                    href={`/dashboard/execution?organization=${encodeURIComponent(item.displayName)}&status=${status}&currency=${currency}` as Route}
                    className={`rounded-md px-3 py-2 text-sm ${active ? "bg-ink text-white" : "border border-line bg-paper text-ink"}`}
                  >
                    {item.displayName}
                  </Link>
                );
              })}
            </div>
          </div>
          <div>
            <div className="text-sm font-medium text-black/70">执行状态</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {statusOptions.map((item) => {
                const active = status === item.key;
                return (
                  <Link
                    key={item.key}
                    href={`/dashboard/execution?organization=${organization}&status=${item.key}&currency=${currency}` as Route}
                    className={`rounded-md px-3 py-2 text-sm ${active ? "bg-ink text-white" : "border border-line bg-paper text-ink"}`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
          <div>
            <div className="text-sm font-medium text-black/70">币种</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {currencyOptions.map((item) => {
                const active = currency === item.key;
                return (
                  <Link
                    key={item.key}
                    href={`/dashboard/execution?organization=${organization}&status=${status}&currency=${item.key}` as Route}
                    className={`rounded-md px-3 py-2 text-sm ${active ? "bg-ink text-white" : "border border-line bg-paper text-ink"}`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-line bg-white">
        <div className="border-b border-line px-6 py-4">
          <div className="text-lg font-semibold">执行队列</div>
          <div className="mt-1 text-sm text-black/55">先看默认账户、剩余待付和核对状态，再进入单据详情登记执行。</div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[1480px] border-collapse text-left text-sm">
            <thead className="bg-paper">
              <tr>
                {[
                  "单据编号",
                  "单据标题",
                  "组织",
                  "付款对象",
                  "币种",
                  "申请金额",
                  "已付金额",
                  "剩余待付",
                  "入账状态",
                  "当前状态",
                  "执行队列",
                  "默认付款账户",
                  "开户行",
                  "最新流水号",
                  "核对状态",
                  "最近说明",
                  "动作"
                ].map((label) => (
                  <th key={label} className="px-6 py-3 font-medium text-black/60">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className={`border-t border-line ${row.status === "paid" ? "bg-emerald-50/40" : row.status === "partially_paid" ? "bg-amber-50/40" : ""}`}>
                  <td className="px-6 py-4 font-medium text-bronze">
                    <Link href={`/dashboard/requests/payments/${row.id}` as Route}>{row.id}</Link>
                  </td>
                  <td className="px-6 py-4">{row.title}</td>
                  <td className="px-6 py-4">{row.organization}</td>
                  <td className="px-6 py-4">{row.paymentPartyName}</td>
                  <td className="px-6 py-4">{row.currency}</td>
                  <td className="px-6 py-4">{formatMoney(row.amount, row.currency)}</td>
                  <td className="px-6 py-4">{formatMoney(row.paidAmount, row.currency)}</td>
                  <td className="px-6 py-4">{formatMoney(row.remainingAmount, row.currency)}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${row.autoLedgerPosted ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-700"}`}>
                      {row.autoLedgerPosted ? "审批已自动入账" : "未形成自动分录"}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${getStatusTone(row.status)}`}>
                      {paymentStatusLabels[row.status]}
                    </span>
                  </td>
                  <td className="px-6 py-4">{row.executionQueueLabel}</td>
                  <td className="px-6 py-4">{row.defaultBankAccountName}</td>
                  <td className="px-6 py-4">{row.defaultBankName}</td>
                  <td className="px-6 py-4">{row.latestExecutionReference}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                      row.latestVerificationStatus === "verified"
                        ? "bg-emerald-50 text-emerald-700"
                        : row.latestVerificationStatus === "exception"
                          ? "bg-rose-50 text-rose-700"
                          : "bg-amber-50 text-amber-700"
                    }`}>
                      {row.latestVerificationStatus === "verified" ? "已核对" : row.latestVerificationStatus === "exception" ? "核对异常" : "待核对"}
                    </span>
                  </td>
                  <td className="max-w-xs px-6 py-4 text-black/70">{row.latestExecutionNote}</td>
                  <td className="px-6 py-4">
                    <Link
                      href={`/dashboard/requests/payments/${row.id}` as Route}
                      className="rounded-md border border-line bg-paper px-3 py-2 text-xs font-medium text-ink"
                    >
                      进入处理
                    </Link>
                  </td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={17} className="px-6 py-10 text-center text-black/45">
                    当前筛选条件下没有待执行单据
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <div className="rounded-lg border border-line bg-white p-6">
          <h2 className="text-lg font-semibold">工作台原则</h2>
          <ul className="mt-4 space-y-3 text-sm leading-6 text-black/65">
            <li>审批通过后的单据统一进入付款执行队列。</li>
            <li>部分付款和已付款核对不和审批待办混在一起。</li>
            <li>默认账户由后台决定，前台只做选择和核对。</li>
          </ul>
        </div>
        <div className="rounded-lg border border-line bg-white p-6">
          <h2 className="text-lg font-semibold">财务动作</h2>
          <ul className="mt-4 space-y-3 text-sm leading-6 text-black/65">
            <li>待付款：登记第一笔付款</li>
            <li>部分付款：补足剩余金额</li>
            <li>已付款：核对执行结果</li>
          </ul>
        </div>
        <div className="rounded-lg border border-line bg-white p-6">
          <h2 className="text-lg font-semibold">联动关系</h2>
          <ul className="mt-4 space-y-3 text-sm leading-6 text-black/65">
            <li>审批中心解决“谁来处理”。</li>
            <li>付款执行工作台解决“财务下一步做什么”。</li>
            <li>详情页完成真正执行动作和付款核对闭环。</li>
          </ul>
        </div>
      </section>
    </main>
  );
}
