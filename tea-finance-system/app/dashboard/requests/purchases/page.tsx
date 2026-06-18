import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import type { Route } from "next";

import { requirePageAccess } from "@/lib/auth";
import { formatMoney, getPurchaseRequests, getPurchaseSummary } from "@/lib/demo-store";

export default async function PurchaseRequestsPage() {
  noStore();
  await requirePageAccess("purchase_requests");
  const [rows, summary] = await Promise.all([getPurchaseRequests(), getPurchaseSummary()]);

  return (
    <main className="space-y-6">
      <header className="rounded-lg border border-line bg-white p-6">
        <div className="text-sm uppercase tracking-[0.18em] text-bronze">purchase requests</div>
        <h1 className="mt-2 text-3xl font-semibold">采购申请</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-black/65">采购申请通过后自动形成采购台账，这里统一看申请、审批和台账结果。</p>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {[
          { label: "申请总数", value: String(summary.total) },
          { label: "审批中", value: String(summary.processing) },
          { label: "已通过", value: String(summary.approved) },
          { label: "采购台账", value: String(summary.ledgerCreated) },
          { label: "申请总额", value: formatMoney(summary.requestedTotal, "RUB") }
        ].map((item) => (
          <div key={item.label} className="rounded-lg border border-line bg-white p-5">
            <div className="text-sm text-black/55">{item.label}</div>
            <div className="mt-3 text-2xl font-semibold">{item.value}</div>
          </div>
        ))}
      </section>

      <section className="rounded-lg border border-line bg-white">
        <div className="border-b border-line px-6 py-4">
          <div className="text-lg font-semibold">采购申请队列</div>
          <div className="mt-1 text-sm text-black/55">统一看申请状态、当前处理人和台账结果。</div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[1280px] border-collapse text-left text-sm">
            <thead className="bg-paper">
              <tr>
                {["编号", "标题", "组织", "供应商", "类型", "金额", "状态", "处理人", "到货", "动作"].map((label) => (
                  <th key={label} className="px-6 py-3 font-medium text-black/60">{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-line">
                  <td className="px-6 py-4 font-medium text-bronze">{row.id}</td>
                  <td className="px-6 py-4">{row.title}</td>
                  <td className="px-6 py-4">{row.organization}</td>
                  <td className="px-6 py-4">{row.supplierName}</td>
                  <td className="px-6 py-4">{row.purchaseType}</td>
                  <td className="px-6 py-4">{formatMoney(row.amount, row.currency)}</td>
                  <td className="px-6 py-4">{getPurchaseStatusLabel(row.status)}</td>
                  <td className="px-6 py-4">{row.currentHandler ?? "-"}</td>
                  <td className="px-6 py-4">{row.expectedArrivalDate}</td>
                  <td className="px-6 py-4">
                    <Link href={`/dashboard/requests/purchases/${row.id}` as Route} className="rounded-md border border-line bg-paper px-3 py-2 text-xs font-medium text-ink">
                      进入处理
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function getPurchaseStatusLabel(status: string) {
  return {
    draft: "草稿",
    submitted: "已提交",
    processing: "审批中",
    approved: "已通过",
    ledger_created: "已生成台账",
    rejected: "已驳回",
    cancelled: "已取消"
  }[status] ?? status;
}
