import { unstable_noStore as noStore } from "next/cache";

import { requirePageAccess } from "@/lib/auth";
import {
  formatMoney,
  getAllLedgerEntries,
  getLedgerAccountRows,
  getLedgerAccountGroupRows,
  getLedgerMonthOptions,
  getLedgerSourceRows,
  getLedgerSummary,
  getOrganizationConfigViewAsync
} from "@/lib/demo-store";

type LedgerPageProps = {
  searchParams?: Promise<{
    organization?: string;
    month?: string;
  }>;
};

export default async function LedgerPage({ searchParams }: LedgerPageProps) {
  noStore();
  await requirePageAccess("ledger");
  const params = (await searchParams) ?? {};
  const filters = {
    organization: params.organization,
    month: params.month
  };
  const [ledgerEntries, ledgerSummary, accountRows, accountGroupRows, sourceRows, monthOptions, organizations] = await Promise.all([
    getAllLedgerEntries(),
    getLedgerSummary(filters),
    getLedgerAccountRows(filters),
    getLedgerAccountGroupRows(filters),
    getLedgerSourceRows(filters),
    getLedgerMonthOptions(),
    getOrganizationConfigViewAsync()
  ]);
  const activeOrganizations = organizations.filter((item) => item.isActive);
  const scopedEntries = ledgerEntries.filter(
    (entry) =>
      (!filters.organization || filters.organization === "all" || entry.organization === filters.organization) &&
      (!filters.month || entry.businessDate.startsWith(filters.month))
  );
  return (
    <main className="space-y-6">
      <header className="rounded-lg border border-line bg-white p-6">
        <div className="text-sm uppercase tracking-[0.18em] text-bronze">ledger</div>
        <h1 className="mt-2 text-3xl font-semibold">总账</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-black/65">
          第一版总账以审批通过自动入账为主，同时兼容内部往来、资产数据、库存数据与初始化导入。
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

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        {[
          { label: "总分录数", value: String(ledgerSummary.entryCount) },
          { label: "涉及组织", value: String(ledgerSummary.organizationCount) },
          { label: "涉及科目", value: String(ledgerSummary.accountCount) },
          { label: "自动入账分录", value: String(ledgerSummary.autoPostedCount) },
          { label: "已核对执行", value: String(ledgerSummary.verifiedExecutionCount) },
          { label: "执行异常", value: String(ledgerSummary.executionExceptionCount) },
          { label: "本期流出", value: formatMoney(ledgerSummary.outflow, "RUB") },
          { label: "本期流入", value: formatMoney(ledgerSummary.inflow, "RUB") },
          { label: "净现金流", value: formatMoney(ledgerSummary.netCashflow, "RUB") },
          { label: "外币分录数", value: String(ledgerSummary.foreignCurrencyCount) }
        ].map((item) => (
          <div key={item.label} className="rounded-lg border border-line bg-white p-5">
            <div className="text-sm text-black/55">{item.label}</div>
            <div className="mt-3 text-xl font-semibold">{item.value}</div>
          </div>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-lg border border-line bg-white">
          <div className="border-b border-line px-6 py-4">
            <div className="text-lg font-semibold">来源结构</div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-left text-sm">
              <thead className="bg-paper">
                <tr>
                  {["来源", "分录数", "流入", "流出"].map((label) => (
                    <th key={label} className="px-6 py-3 font-medium text-black/60">{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sourceRows.map((row) => (
                  <tr key={row.sourceType} className="border-t border-line">
                    <td className="px-6 py-4">{getLedgerSourceTypeLabel(row.sourceType)}</td>
                    <td className="px-6 py-4">{row.entryCount}</td>
                    <td className="px-6 py-4">{formatMoney(row.inflow, "RUB")}</td>
                    <td className="px-6 py-4">{formatMoney(row.outflow, "RUB")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-lg border border-line bg-white">
          <div className="border-b border-line px-6 py-4">
            <div className="text-lg font-semibold">科目组结构</div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-left text-sm">
              <thead className="bg-paper">
                <tr>
                  {["科目组", "分录数", "流入", "流出", "净额"].map((label) => (
                    <th key={label} className="px-6 py-3 font-medium text-black/60">{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {accountGroupRows.map((row) => (
                  <tr key={row.accountGroup} className="border-t border-line">
                    <td className="px-6 py-4">{row.accountGroup}</td>
                    <td className="px-6 py-4">{row.entryCount}</td>
                    <td className="px-6 py-4">{formatMoney(row.inflow, "RUB")}</td>
                    <td className="px-6 py-4">{formatMoney(row.outflow, "RUB")}</td>
                    <td className="px-6 py-4">{formatMoney(row.balance, "RUB")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-line bg-white">
        <div className="border-b border-line px-6 py-4">
          <div className="text-lg font-semibold">科目汇总</div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead className="bg-paper">
              <tr>
                {["科目编码", "科目名称", "科目组", "分录数", "流入", "流出", "净额"].map((label) => (
                  <th key={label} className="px-6 py-3 font-medium text-black/60">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {accountRows.map((row) => (
                <tr key={row.accountCode} className="border-t border-line">
                  <td className="px-6 py-4">{row.accountCode}</td>
                  <td className="px-6 py-4 font-medium">{row.accountName}</td>
                  <td className="px-6 py-4">{row.accountGroup}</td>
                  <td className="px-6 py-4">{row.entryCount}</td>
                  <td className="px-6 py-4">{formatMoney(row.inflow, "RUB")}</td>
                  <td className="px-6 py-4">{formatMoney(row.outflow, "RUB")}</td>
                  <td className="px-6 py-4">{formatMoney(row.balance, "RUB")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border border-line bg-white">
        <div className="border-b border-line px-6 py-4">
          <div className="text-lg font-semibold">总账明细</div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead className="bg-paper">
              <tr>
                {["来源类型", "来源单据", "所属组织", "业务日期", "原币金额", "汇率", "本位币金额", "科目编码", "科目名称", "摘要"].map((label) => (
                  <th key={label} className="px-6 py-3 font-medium text-black/60">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {scopedEntries.map((entry) => (
                <tr key={entry.id} className="border-t border-line">
                  <td className="px-6 py-4">{getLedgerSourceTypeLabel(entry.sourceType)}</td>
                  <td className="px-6 py-4">{entry.sourceNo}</td>
                  <td className="px-6 py-4">{entry.organization}</td>
                  <td className="px-6 py-4">{entry.businessDate}</td>
                  <td className="px-6 py-4">{formatMoney(entry.originalAmount, entry.currency)}</td>
                  <td className="px-6 py-4">{entry.exchangeRate}</td>
                  <td className="px-6 py-4">{formatMoney(entry.functionalAmount, "RUB")}</td>
                  <td className="px-6 py-4">{entry.accountCode}</td>
                  <td className="px-6 py-4">{entry.accountName}</td>
                  <td className="px-6 py-4">{entry.summary}</td>
                </tr>
              ))}
              {scopedEntries.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-6 py-10 text-center text-black/45">
                    当前筛选条件下没有分录
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function getLedgerSourceTypeLabel(sourceType: string) {
  if (sourceType === "payment_request_approval") {
    return "审批自动入账";
  }
  if (sourceType === "payment_request") {
    return "付款申请";
  }
  return sourceType;
}
