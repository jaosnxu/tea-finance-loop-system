import type { Route } from "next";
import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";

import { requirePageAccess } from "@/lib/auth";
import {
  formatMoney,
  getFilteredPaymentWorkflowSummary,
  getFilteredPaymentRequests,
  getOrganizationByName,
  getExecutionsByRequestId,
  getStatusTone,
  paymentStatusLabels
} from "@/lib/demo-store";

const columns = ["单据编号", "所属组织", "税务方式", "付款对象", "币种", "申请金额", "已付金额", "当前状态"];

const statusOptions = [
  { key: "all", label: "全部状态" },
  { key: "draft", label: "草稿" },
  { key: "ocr_pending", label: "OCR识别中" },
  { key: "ocr_exception_pending_confirm", label: "OCR异常待确认" },
  { key: "processing", label: "审批中" },
  { key: "approved_waiting_payment", label: "待付款" },
  { key: "partially_paid", label: "部分付款" },
  { key: "paid", label: "已付款" },
  { key: "rejected", label: "已驳回" },
  { key: "cancelled", label: "已取消" }
] as const;

function getRoleLabel(role: "boss" | "finance" | "cashier" | "applicant") {
  return {
    boss: "老板",
    finance: "财务",
    cashier: "出纳",
    applicant: "申请人"
  }[role];
}

type PaymentListStatus = (typeof statusOptions)[number]["key"];

type PaymentRequestsPageProps = {
  searchParams?: Promise<{
    status?: string;
  }>;
};

export default async function PaymentRequestsPage({ searchParams }: PaymentRequestsPageProps) {
  noStore();
  const session = await requirePageAccess("payment_requests");
  const currentParams = (await searchParams) ?? {};
  const role = session.role;
  const status: PaymentListStatus =
    statusOptions.some((item) => item.key === currentParams.status)
      ? (currentParams.status as PaymentListStatus)
      : "all";

  const [summary, paymentRequests] = await Promise.all([
    getFilteredPaymentWorkflowSummary({ role, status }),
    getFilteredPaymentRequests({ role, status })
  ]);
  const executionMap = new Map(
    await Promise.all(
      paymentRequests.map(async (request) => [request.id, await getExecutionsByRequestId(request.id)] as const)
    )
  );

  return (
    <main className="space-y-6">
      <header className="rounded-lg border border-line bg-white p-6">
        <div className="text-sm uppercase tracking-[0.18em] text-bronze">payment requests</div>
        <h1 className="mt-2 text-3xl font-semibold">付款申请</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-black/65">
          这里只保留发起、跟踪和核对。能后台默认的，不让前台重复填写。
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href={"/dashboard/requests/payments/new" as Route}
            className="rounded-md bg-ink px-5 py-3 text-sm font-medium text-white"
          >
            新建付款申请
          </Link>
        </div>
        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          <div className="rounded-md bg-paper px-4 py-3 text-sm text-black/65">
            当前账号角色：<span className="font-medium text-ink">{getRoleLabel(role)}</span>
          </div>
          <div className="flex flex-wrap gap-2 lg:justify-end">
            {statusOptions.map((option) => {
              const active = option.key === status;
              return (
                <Link
                  key={option.key}
                  href={`/dashboard/requests/payments?status=${option.key}` as Route}
                  className={`rounded-md px-3 py-2 text-sm font-medium ${active ? "bg-ink text-white" : "border border-line bg-paper text-ink"}`}
                >
                  {option.label}
                </Link>
              );
            })}
          </div>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {[
          { label: "申请总数", value: summary.total },
          { label: "待处理", value: summary.awaitingApproval },
          { label: "待付款", value: summary.awaitingPayment },
          { label: "执行中", value: summary.partiallyPaid },
          { label: "已自动入账", value: summary.posted }
        ].map((item) => (
          <div key={item.label} className="rounded-lg border border-line bg-white p-5">
            <div className="text-sm text-black/55">{item.label}</div>
            <div className="mt-3 text-2xl font-semibold">{item.value}</div>
          </div>
        ))}
      </section>

      <section className="rounded-lg border border-line bg-white">
        <div className="border-b border-line px-6 py-4">
          <div className="text-lg font-semibold">单据工作台</div>
          <div className="mt-1 text-sm text-black/55">直接看单据卡在哪一步、当前该谁处理，以及是否卡在 OCR / 审批 / 财务执行 / 付款核对。</div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead className="bg-paper">
              <tr>
                {[...columns, "当前审批节点", "当前处理人", "当前卡点"].map((column) => (
                  <th key={column} className="px-6 py-3 font-medium text-black/60">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paymentRequests.map((row) => (
                <tr key={row.id} className="border-t border-line">
                  <td className="px-6 py-4 font-medium text-bronze">
                    <Link href={`/dashboard/requests/payments/${row.id}` as Route}>{row.id}</Link>
                  </td>
                  <td className="px-6 py-4">{row.organization}</td>
                  <td className="px-6 py-4">{getOrganizationByName(row.organization)?.taxLabel ?? "-"}</td>
                  <td className="px-6 py-4">{row.paymentPartyName}</td>
                  <td className="px-6 py-4">{row.currency}</td>
                  <td className="px-6 py-4">{formatMoney(row.amount, row.currency)}</td>
                  <td className="px-6 py-4">{formatMoney(row.paidAmount, row.currency)}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${getStatusTone(row.status)}`}>
                      {paymentStatusLabels[row.status]}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-black/70">{row.currentApprovalNode ?? "-"}</td>
                  <td className="px-6 py-4 text-black/70">{row.currentHandler ?? "-"}</td>
                  <td className="px-6 py-4">
                    <span className="inline-flex rounded-full bg-paper px-3 py-1 text-xs font-medium text-black/70">
                      {getWorkQueueLabel(row.status, executionMap.get(row.id) ?? [])}
                    </span>
                  </td>
                </tr>
              ))}
              {paymentRequests.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-6 py-10 text-center text-black/45">
                    当前筛选条件下没有单据
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

function getWorkQueueLabel(
  status: keyof typeof paymentStatusLabels,
  executions: Array<{ verificationStatus: "pending" | "verified" | "exception" }>
) {
  if (status === "ocr_pending" || status === "ocr_exception_pending_confirm") {
    return "卡在 OCR";
  }
  if (status === "processing") {
    return "卡在审批";
  }
  if (status === "approved_waiting_payment" || status === "partially_paid" || status === "paid") {
    if (status !== "paid") {
      return "卡在财务执行";
    }
    if (executions.some((item) => item.verificationStatus === "exception")) {
      return "等待异常复核";
    }
    if (executions.some((item) => item.verificationStatus === "pending")) {
      return "等待付款核对";
    }
    if (executions.length > 0 && executions.every((item) => item.verificationStatus === "verified")) {
      return "执行已核对";
    }
    return "已付款";
  }
  if (status === "draft") {
    return "待提交";
  }
  if (status === "rejected") {
    return "待修改";
  }
  if (status === "cancelled") {
    return "已取消";
  }
  return "处理中";
}
