import { unstable_noStore as noStore } from "next/cache";

import { requirePageAccess } from "@/lib/auth";
import {
  formatMoney,
  getBalanceSheetRows,
  getBankAccountReportRowsAsync,
  getCashflowCompositionRows,
  getCashflowStatementRows,
  getLedgerMonthOptions,
  getOrganizationConfigViewAsync,
  getOrganizationReportRows,
  getProfitStatementRows,
  getReportComparison,
  getReportsSnapshot
} from "@/lib/demo-store";

type ReportsPageProps = {
  searchParams?: Promise<{
    organization?: string;
    month?: string;
  }>;
};

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  noStore();
  await requirePageAccess("reports");
  const params = (await searchParams) ?? {};
  const filters = {
    organization: params.organization,
    month: params.month
  };
  const [
    { metrics, profit, ledgerCount, ledgerSummary, requestedTotal, paidTotal },
    monthOptions,
    organizations,
    organizationRows,
    bankAccountRows,
    cashflowRows,
    cashflowCompositionRows,
    profitRows,
    balanceSheet,
    comparison
  ] = await Promise.all([
    getReportsSnapshot(filters),
    getLedgerMonthOptions(),
    getOrganizationConfigViewAsync(),
    getOrganizationReportRows(filters),
    getBankAccountReportRowsAsync(),
    getCashflowStatementRows(filters),
    getCashflowCompositionRows(filters),
    getProfitStatementRows(filters),
    getBalanceSheetRows(filters),
    getReportComparison(filters)
  ]);
  const activeOrganizations = organizations.filter((item) => item.isActive);
  const reportCards = [
    { title: "现金流量表", value: formatMoney(ledgerSummary.netCashflow, "RUB"), note: "净现金流" },
    { title: "资产负债表", value: formatMoney(metrics.totalFunds, "RUB"), note: "银行余额" },
    { title: "利润表", value: formatMoney(profit, "RUB"), note: "审批自动入账费用影响" },
    { title: "总账明细", value: String(ledgerCount), note: "审批自动入账分录" },
    { title: "申请总额", value: formatMoney(requestedTotal, "RUB"), note: "全部付款申请" },
    { title: "已付款总额", value: formatMoney(paidTotal, "RUB"), note: "已执行付款" }
  ];

  return (
    <main className="space-y-6">
      <header className="rounded-lg border border-line bg-white p-6">
        <div className="text-sm uppercase tracking-[0.18em] text-bronze">reports</div>
        <h1 className="mt-2 text-3xl font-semibold">报表中心</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-black/65">
          这里统一看组织汇总、自动入账结果和资金口径，不再分散到多个页面核对。
        </p>
      </header>

      <section className="rounded-lg border border-line bg-white p-6">
        <form className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div>
            <div className="text-sm font-medium text-black/70">组织</div>
            <select
              name="organization"
              defaultValue={filters.organization ?? "all"}
              className="mt-2 h-11 w-full rounded-md border border-line bg-white px-4 text-sm outline-none"
            >
              <option value="all">全部组织</option>
              {activeOrganizations.map((organization) => (
                <option key={organization.id} value={organization.displayName}>
                  {organization.displayName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <div className="text-sm font-medium text-black/70">期间</div>
            <select
              name="month"
              defaultValue={filters.month ?? ""}
              className="mt-2 h-11 w-full rounded-md border border-line bg-white px-4 text-sm outline-none"
            >
              <option value="">全部期间</option>
              {monthOptions.map((month) => (
                <option key={month} value={month}>
                  {month}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button className="h-11 rounded-md bg-ink px-5 text-sm font-medium text-white">更新视图</button>
          </div>
        </form>
      </section>

      <section className="rounded-lg border border-line bg-white p-6">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-md bg-paper px-4 py-3 text-sm">
            当前组织：<span className="font-medium">{filters.organization && filters.organization !== "all" ? filters.organization : "全部组织"}</span>
          </div>
          <div className="rounded-md bg-paper px-4 py-3 text-sm">
            当前期间：<span className="font-medium">{filters.month || "全部期间"}</span>
          </div>
          <div className="rounded-md bg-paper px-4 py-3 text-sm">
            口径说明：<span className="font-medium">以审批自动入账和银行余额为主</span>
          </div>
        </div>
      </section>

      {comparison ? (
        <section className="rounded-lg border border-line bg-white p-6">
          <div className="text-lg font-semibold">期间对比</div>
          <div className="mt-4 grid gap-4 md:grid-cols-4">
            <CompareCard
              label="申请总额变化"
              current={comparison.currentMonth}
              previous={comparison.previousMonth}
              value={formatMoney(comparison.requestedDelta, "RUB")}
            />
            <CompareCard
              label="已付款变化"
              current={comparison.currentMonth}
              previous={comparison.previousMonth}
              value={formatMoney(comparison.paidDelta, "RUB")}
            />
            <CompareCard
              label="流出变化"
              current={comparison.currentMonth}
              previous={comparison.previousMonth}
              value={formatMoney(comparison.outflowDelta, "RUB")}
            />
            <CompareCard
              label="自动入账变化"
              current={comparison.currentMonth}
              previous={comparison.previousMonth}
              value={String(comparison.autoPostedDelta)}
            />
          </div>
        </section>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {reportCards.map((report) => (
          <div key={report.title} className="rounded-lg border border-line bg-white p-5">
            <div className="text-lg font-semibold">{report.title}</div>
            <div className="mt-3 text-2xl font-semibold">{report.value}</div>
            <div className="mt-2 text-sm text-black/60">{report.note}</div>
          </div>
        ))}
      </div>

      <section className="grid gap-6 xl:grid-cols-3">
        <div className="rounded-lg border border-line bg-white">
          <div className="border-b border-line px-6 py-4">
            <div className="text-lg font-semibold">现金流量表</div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-left text-sm">
              <tbody>
                {cashflowRows.map((row) => (
                  <tr key={row.label} className="border-t border-line">
                    <td className="px-6 py-4 font-medium">{row.label}</td>
                    <td className="px-6 py-4">
                      {row.label === "本期分录数" ? String(row.amount) : formatMoney(row.amount, "RUB")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-lg border border-line bg-white">
          <div className="border-b border-line px-6 py-4">
            <div className="text-lg font-semibold">现金流构成</div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-left text-sm">
              <tbody>
                {cashflowCompositionRows.map((row) => (
                  <tr key={row.label} className="border-t border-line">
                    <td className="px-6 py-4 font-medium">{row.label}</td>
                    <td className="px-6 py-4">{formatMoney(row.amount, "RUB")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-lg border border-line bg-white">
          <div className="border-b border-line px-6 py-4">
            <div className="text-lg font-semibold">利润表</div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-left text-sm">
              <thead className="bg-paper">
                <tr>
                  {["科目", "科目组", "费用", "收入", "利润影响"].map((label) => (
                    <th key={label} className="px-6 py-3 font-medium text-black/60">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {profitRows.map((row) => (
                  <tr key={row.accountCode} className="border-t border-line">
                    <td className="px-6 py-4 font-medium">{row.accountName}</td>
                    <td className="px-6 py-4">{row.accountGroup}</td>
                    <td className="px-6 py-4">{formatMoney(row.expenseAmount, "RUB")}</td>
                    <td className="px-6 py-4">{formatMoney(row.incomeAmount, "RUB")}</td>
                    <td className="px-6 py-4">{formatMoney(row.profitImpact, "RUB")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-lg border border-line bg-white">
          <div className="border-b border-line px-6 py-4">
            <div className="text-lg font-semibold">资产负债表</div>
          </div>
          <div className="px-6 py-4 text-sm">
            <div className="font-medium text-black/70">资产</div>
            <div className="mt-3 space-y-2">
              {balanceSheet.assets.map((row) => (
                <div key={row.label} className="flex items-center justify-between gap-4">
                  <span>{row.label}</span>
                  <span>{formatMoney(row.amount, "RUB")}</span>
                </div>
              ))}
            </div>
            <div className="mt-6 font-medium text-black/70">负债</div>
            <div className="mt-3 space-y-2">
              {balanceSheet.liabilities.map((row) => (
                <div key={row.label} className="flex items-center justify-between gap-4">
                  <span>{row.label}</span>
                  <span>{formatMoney(row.amount, "RUB")}</span>
                </div>
              ))}
            </div>
            <div className="mt-6 font-medium text-black/70">权益</div>
            <div className="mt-3 space-y-2">
              {balanceSheet.equity.map((row) => (
                <div key={row.label} className="flex items-center justify-between gap-4">
                  <span>{row.label}</span>
                  <span>{formatMoney(row.amount, "RUB")}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-line bg-white">
        <div className="border-b border-line px-6 py-4">
          <div className="text-lg font-semibold">组织汇总视图</div>
          <div className="mt-1 text-sm text-black/55">老板按组织查看现金流和付款规模，审批通过后的自动入账仍按组织独立核算。</div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead className="bg-paper">
              <tr>
                {["组织", "税务方式", "本位币", "结算角色", "申请单数", "申请总额", "已付款", "自动入账单数", "执行异常", "审批自动入账支出"].map((label) => (
                  <th key={label} className="px-6 py-3 font-medium text-black/60">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {organizationRows.map((row) => (
                <tr key={row.id} className="border-t border-line">
                  <td className="px-6 py-4 font-medium">{row.organization}</td>
                  <td className="px-6 py-4">{row.taxLabel}</td>
                  <td className="px-6 py-4">{row.baseCurrency}</td>
                  <td className="px-6 py-4">{row.settlementRole}</td>
                  <td className="px-6 py-4">{row.requestCount}</td>
                  <td className="px-6 py-4">{formatMoney(row.requestedTotal, "RUB")}</td>
                  <td className="px-6 py-4">{formatMoney(row.paidTotal, "RUB")}</td>
                  <td className="px-6 py-4">{row.autoPostedCount}</td>
                  <td className="px-6 py-4">{row.executionExceptionCount}</td>
                  <td className="px-6 py-4">{formatMoney(row.outflowTotal, "RUB")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border border-line bg-white">
        <div className="border-b border-line px-6 py-4">
          <div className="text-lg font-semibold">付款账户策略视图</div>
          <div className="mt-1 text-sm text-black/55">老板按组织和币种看可用账户、默认付款账户和当前银行余额。</div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead className="bg-paper">
              <tr>
                {["组织", "币种", "默认付款账户", "开户行", "启用账户数", "资金余额"].map((label) => (
                  <th key={label} className="px-6 py-3 font-medium text-black/60">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bankAccountRows.map((row) => (
                <tr key={row.id} className="border-t border-line">
                  <td className="px-6 py-4 font-medium">{row.organization}</td>
                  <td className="px-6 py-4">{row.currency}</td>
                  <td className="px-6 py-4">{row.defaultAccountName}</td>
                  <td className="px-6 py-4">{row.defaultBankName}</td>
                  <td className="px-6 py-4">{row.activeAccountCount}</td>
                  <td className="px-6 py-4">{formatMoney(row.totalBalance, row.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function CompareCard({
  label,
  current,
  previous,
  value
}: {
  label: string;
  current: string;
  previous: string | null;
  value: string;
}) {
  return (
    <div className="rounded-md border border-line bg-paper px-4 py-4">
      <div className="text-sm text-black/55">{label}</div>
      <div className="mt-2 text-xl font-semibold">{value}</div>
      <div className="mt-2 text-xs text-black/45">
        {current}{previous ? ` 对比 ${previous}` : ""}
      </div>
    </div>
  );
}
