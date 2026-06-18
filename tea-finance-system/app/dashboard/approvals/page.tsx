import { unstable_noStore as noStore } from "next/cache";
import Link from "next/link";
import type { Route } from "next";

import { requirePageAccess } from "@/lib/auth";
import {
  ApprovalCenterTab,
  getApprovalRoleQueues,
  formatMoney,
  getApprovalCenterRows,
  getApprovalCenterSummary,
  getOrganizationConfigViewAsync,
  getStatusTone,
  paymentStatusLabels
} from "@/lib/demo-store";

const tabOptions: Array<{ key: ApprovalCenterTab; label: string }> = [
  { key: "inbox", label: "待我处理" },
  { key: "submitted", label: "我发起的" },
  { key: "processed", label: "我已处理" },
  { key: "cc", label: "抄送我的" },
  { key: "exceptions", label: "异常单据" }
];

function getRoleLabel(role: "boss" | "finance" | "cashier" | "applicant") {
  return {
    boss: "老板",
    finance: "财务",
    cashier: "出纳",
    applicant: "申请人"
  }[role];
}

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

type ApprovalsPageProps = {
  searchParams?: Promise<{
    tab?: string;
    status?: string;
    organization?: string;
    exceptionType?: string;
  }>;
};

function getDefaultTab(role: "boss" | "finance" | "cashier" | "applicant"): ApprovalCenterTab {
  if (role === "cashier") return "exceptions";
  if (role === "applicant") return "submitted";
  return "inbox";
}

export default async function ApprovalsPage({ searchParams }: ApprovalsPageProps) {
  noStore();
  const session = await requirePageAccess("approvals");
  const params = (await searchParams) ?? {};
  const role = session.role;
  const tab = tabOptions.some((item) => item.key === params.tab)
    ? (params.tab as ApprovalCenterTab)
    : getDefaultTab(role);
  const status = statusOptions.some((item) => item.key === params.status) ? params.status! : "all";
  const organization = params.organization ?? "all";
  const exceptionType = params.exceptionType ?? "all";

  const [summary, rows, organizations] = await Promise.all([
    getApprovalCenterSummary(role),
    getApprovalCenterRows({ role, tab, status: status as (typeof statusOptions)[number]["key"], organization }),
    getOrganizationConfigViewAsync()
  ]);
  const queueRows = await getApprovalRoleQueues(role);
  const filteredRows =
    tab === "exceptions" && exceptionType !== "all"
      ? rows.filter((row) => row.exceptionFlag === exceptionType)
      : rows;
  const activeOrganizations = organizations.filter((item) => item.isActive);

  return (
    <main className="space-y-6">
      <header className="rounded-lg border border-line bg-white p-6">
        <div className="text-sm uppercase tracking-[0.18em] text-bronze">audit and approvals</div>
        <h1 className="mt-2 text-3xl font-semibold">审批与稽核</h1>
        <p className="mt-3 max-w-4xl text-sm leading-6 text-black/65">
          集中处理审批待办、OCR 异常、驳回复核和付款前卡点，不再分散到多个列表里找入口。
        </p>

        <div className="mt-5 rounded-md bg-paper px-4 py-3 text-sm text-black/65">
          当前岗位：<span className="font-medium text-ink">{getRoleLabel(role)}</span>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {tabOptions.map((option) => {
            const active = option.key === tab;
            return (
              <Link
                key={option.key}
                href={`/dashboard/approvals?tab=${option.key}&status=${status}&organization=${organization}&exceptionType=${exceptionType}` as Route}
                className={`rounded-md px-4 py-2 text-sm font-medium ${active ? "bg-ink text-white" : "border border-line bg-paper text-ink"}`}
              >
                {option.label}
              </Link>
            );
          })}
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        {[
          { label: "待我处理", value: summary.inbox },
          { label: "今日新增", value: summary.todayNew },
          { label: "待付款", value: summary.awaitingPayment },
          { label: "已付款", value: summary.paidCompleted },
          { label: "异常单据", value: summary.exceptions },
          { label: "已逾期", value: summary.overdue }
        ].map((item) => (
          <div key={item.label} className="rounded-lg border border-line bg-white p-5">
            <div className="text-sm text-black/55">{item.label}</div>
            <div className="mt-3 text-2xl font-semibold">{item.value}</div>
          </div>
        ))}
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {queueRows.map((item) => (
          <div key={item.label} className="rounded-lg border border-line bg-white p-5">
            <div className="text-sm text-black/55">{item.label}</div>
            <div className="mt-3 text-2xl font-semibold">{item.value}</div>
          </div>
        ))}
      </section>

      <section className="rounded-lg border border-line bg-white p-6">
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <div className="text-sm font-medium text-black/70">当前角色</div>
            <div className="mt-2 rounded-md bg-paper px-4 py-3 text-sm">{getRoleLabel(role)}</div>
          </div>
          <div>
            <div className="text-sm font-medium text-black/70">组织范围</div>
            <div className="mt-2 flex flex-wrap gap-2">
              <Link
                href={`/dashboard/approvals?tab=${tab}&status=${status}&organization=all&exceptionType=${exceptionType}` as Route}
                className={`rounded-md px-3 py-2 text-sm ${organization === "all" ? "bg-ink text-white" : "border border-line bg-paper text-ink"}`}
              >
                全部组织
              </Link>
              {activeOrganizations.map((item) => {
                const active = organization === item.displayName;
                return (
                  <Link
                    key={item.id}
                    href={`/dashboard/approvals?tab=${tab}&status=${status}&organization=${encodeURIComponent(item.displayName)}&exceptionType=${exceptionType}` as Route}
                    className={`rounded-md px-3 py-2 text-sm ${active ? "bg-ink text-white" : "border border-line bg-paper text-ink"}`}
                  >
                    {item.displayName}
                  </Link>
                );
              })}
            </div>
          </div>
          <div>
            <div className="text-sm font-medium text-black/70">状态筛选</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {statusOptions.map((item) => {
                const active = status === item.key;
                return (
                  <Link
                    key={item.key}
                    href={`/dashboard/approvals?tab=${tab}&status=${item.key}&organization=${organization}&exceptionType=${exceptionType}` as Route}
                    className={`rounded-md px-3 py-2 text-sm ${active ? "bg-ink text-white" : "border border-line bg-paper text-ink"}`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div className="rounded-md bg-paper px-4 py-3 text-sm">
            当前视图：<span className="font-medium">{tabOptions.find((item) => item.key === tab)?.label}</span>
          </div>
          <div className="rounded-md bg-paper px-4 py-3 text-sm">
            我发起的：<span className="font-medium">{summary.submitted}</span>
          </div>
          <div className="rounded-md bg-paper px-4 py-3 text-sm">
            我已处理 / 抄送：<span className="font-medium">{summary.processed} / {summary.cc}</span>
          </div>
        </div>
        {tab === "exceptions" ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {["all", "OCR异常", "已驳回", "已逾期"].map((item) => {
              const active = exceptionType === item;
              return (
                <Link
                  key={item}
                  href={`/dashboard/approvals?tab=${tab}&status=${status}&organization=${organization}&exceptionType=${encodeURIComponent(item)}` as Route}
                  className={`rounded-md px-3 py-2 text-sm ${active ? "bg-ink text-white" : "border border-line bg-paper text-ink"}`}
                >
                  {item === "all" ? "全部异常" : item}
                </Link>
              );
            })}
          </div>
        ) : null}
      </section>

      <section className="rounded-lg border border-line bg-white">
        <div className="border-b border-line px-6 py-4">
          <div className="text-lg font-semibold">待办与异常队列</div>
          <div className="mt-1 text-sm text-black/55">先看卡点、当前处理人和异常类型，再进入单据详情处理。</div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[1560px] border-collapse text-left text-sm">
            <thead className="bg-paper">
              <tr>
                {[
                  "单据编号",
                  "单据标题",
                  "组织",
                  "申请人",
                  "金额",
                  "币种",
                  "当前状态",
                  "当前审批节点",
                  "当前处理人",
                  "提交时间",
                  "最后更新时间",
                  "异常标记",
                  "优先级",
                  "当前卡点",
                  "最近意见",
                  "流程轨迹"
                ].map((label) => (
                  <th key={label} className="px-6 py-3 font-medium text-black/60">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => (
                <tr
                  key={row.id}
                  className={`border-t border-line ${
                    row.exceptionFlag !== "-" ? "bg-rose-50/40" : row.isOverdue ? "bg-amber-50/40" : ""
                  }`}
                >
                  <td className="px-6 py-4 font-medium text-bronze">
                    <Link href={`/dashboard/requests/payments/${row.id}` as Route}>{row.id}</Link>
                  </td>
                  <td className="px-6 py-4">{row.title}</td>
                  <td className="px-6 py-4">{row.organization}</td>
                  <td className="px-6 py-4">{row.applicantName}</td>
                  <td className="px-6 py-4">{formatMoney(row.amount, row.currency)}</td>
                  <td className="px-6 py-4">{row.currency}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${getStatusTone(row.status)}`}>
                      {paymentStatusLabels[row.status]}
                    </span>
                  </td>
                  <td className="px-6 py-4">{row.currentApprovalNode ?? "-"}</td>
                  <td className="px-6 py-4">{row.currentHandler ?? "-"}</td>
                  <td className="px-6 py-4">{row.requestedAt}</td>
                  <td className="px-6 py-4">{row.latestUpdatedAt}</td>
                  <td className="px-6 py-4">{row.exceptionFlag}</td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                        row.priorityLabel === "异常"
                          ? "bg-rose-50 text-rose-700"
                          : row.priorityLabel === "高金额"
                            ? "bg-amber-50 text-amber-700"
                            : row.priorityLabel === "待付款"
                              ? "bg-sky-50 text-sky-700"
                              : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {row.priorityLabel}
                    </span>
                    {row.isOverdue ? <span className="ml-2 text-xs text-rose-600">已逾期</span> : null}
                  </td>
                  <td className="px-6 py-4">{row.currentStepLabel}</td>
                  <td className="max-w-xs px-6 py-4 text-black/70">{row.latestNote}</td>
                  <td className="max-w-sm px-6 py-4 text-black/60">{row.workflowNodeSummary}</td>
                </tr>
              ))}
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={16} className="px-6 py-10 text-center text-black/45">
                    当前视图下没有单据
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <div className="rounded-lg border border-line bg-white p-6">
          <h2 className="text-lg font-semibold">默认工作入口</h2>
          <ul className="mt-4 space-y-3 text-sm leading-6 text-black/65">
            <li>老板：默认看待我处理</li>
            <li>财务：默认看待我处理</li>
            <li>出纳：默认看异常单据</li>
            <li>申请人：默认看我发起的</li>
          </ul>
        </div>
        <div className="rounded-lg border border-line bg-white p-6">
          <h2 className="text-lg font-semibold">异常判断口径</h2>
          <ul className="mt-4 space-y-3 text-sm leading-6 text-black/65">
            <li>OCR 异常待确认</li>
            <li>已驳回待修改</li>
            <li>已逾期未闭环单据</li>
          </ul>
        </div>
        <div className="rounded-lg border border-line bg-white p-6">
          <h2 className="text-lg font-semibold">处理方式</h2>
          <ul className="mt-4 space-y-3 text-sm leading-6 text-black/65">
            <li>工作台点击单号直接进入详情页</li>
            <li>详情页继续完成通过、驳回、退回修改、财务执行和付款核对</li>
            <li>列表先判断卡点、意见和轨迹，再决定是否进入详情</li>
          </ul>
        </div>
      </section>
    </main>
  );
}
