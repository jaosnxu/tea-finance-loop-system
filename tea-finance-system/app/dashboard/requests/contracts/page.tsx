import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import type { Route } from "next";

import { requirePageAccess } from "@/lib/auth";
import { formatMoney, getContractApprovals, getContractSummary } from "@/lib/demo-store";

export default async function ContractApprovalsPage() {
  noStore();
  await requirePageAccess("contract_requests");
  const [rows, summary] = await Promise.all([getContractApprovals(), getContractSummary()]);

  return (
    <main className="space-y-6">
      <header className="rounded-lg border border-line bg-white p-6">
        <div className="text-sm uppercase tracking-[0.18em] text-bronze">contract approvals</div>
        <h1 className="mt-2 text-3xl font-semibold">合同审批</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-black/65">合同审批通过后自动形成合同台账，这里统一看审批进度和合同依据。</p>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {[
          { label: "合同总数", value: String(summary.total) },
          { label: "审批中", value: String(summary.processing) },
          { label: "已通过", value: String(summary.approved) },
          { label: "合同台账", value: String(summary.ledgerCreated) },
          { label: "通过金额", value: formatMoney(summary.approvedAmount, "RUB") }
        ].map((item) => (
          <div key={item.label} className="rounded-lg border border-line bg-white p-5">
            <div className="text-sm text-black/55">{item.label}</div>
            <div className="mt-3 text-2xl font-semibold">{item.value}</div>
          </div>
        ))}
      </section>

      <section className="rounded-lg border border-line bg-white">
        <div className="border-b border-line px-6 py-4">
          <div className="text-lg font-semibold">合同审批队列</div>
          <div className="mt-1 text-sm text-black/55">统一看审批状态、OCR情况和合同台账结果。</div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[1320px] border-collapse text-left text-sm">
            <thead className="bg-paper">
              <tr>
                {["编号", "合同名称", "组织", "相对方", "类型", "金额", "状态", "OCR状态", "处理人", "动作"].map((label) => (
                  <th key={label} className="px-6 py-3 font-medium text-black/60">{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-line">
                  <td className="px-6 py-4 font-medium text-bronze">{row.id}</td>
                  <td className="px-6 py-4">{row.contractName}</td>
                  <td className="px-6 py-4">{row.organization}</td>
                  <td className="px-6 py-4">{row.counterpartyName}</td>
                  <td className="px-6 py-4">{row.contractType}</td>
                  <td className="px-6 py-4">{formatMoney(row.amount, row.currency)}</td>
                  <td className="px-6 py-4">{getContractStatusLabel(row.status)}</td>
                  <td className="px-6 py-4">{getOcrStatusLabel(row.ocrStatus)}</td>
                  <td className="px-6 py-4">{row.currentHandler ?? "-"}</td>
                  <td className="px-6 py-4">
                    <Link href={`/dashboard/requests/contracts/${row.id}` as Route} className="rounded-md border border-line bg-paper px-3 py-2 text-xs font-medium text-ink">
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

function getContractStatusLabel(status: string) {
  return {
    draft: "草稿",
    submitted: "已提交",
    ocr_pending: "OCR识别中",
    ocr_exception_pending_confirm: "OCR异常待确认",
    processing: "审批中",
    approved: "已通过",
    ledger_created: "已生成台账",
    rejected: "已驳回",
    cancelled: "已取消"
  }[status] ?? status;
}

function getOcrStatusLabel(status: string) {
  return {
    not_started: "未启动",
    processing: "识别中",
    matched: "识别一致",
    exception_pending_confirm: "异常待确认",
    confirmed_exception: "异常已确认"
  }[status] ?? status;
}
