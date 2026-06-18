import { notFound } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import Link from "next/link";
import type { Route } from "next";

import { canAccessOwningUser, requirePageAccess } from "@/lib/auth";
import { canAccessOrganization } from "@/lib/access";
import {
  formatMoney,
  getStatusTone,
  ocrStatusLabels,
  paymentStatusLabels,
  workflowSteps
} from "@/lib/mock-data";
import {
  getApprovalFlowProgress,
  getBankAccountsForOrganizationCurrency,
  getDefaultBankAccountForOrganizationCurrency,
  getExecutionsByRequestId,
  getLedgerEntriesByRequestId,
  getOrganizationByName,
  getPaymentRequestById
} from "@/lib/demo-store";
import { recordPaymentExecutionAction, transitionPaymentRequestAction, verifyPaymentExecutionAction } from "@/app/dashboard/requests/payments/actions";

type RequestDetailPageProps = {
  params: Promise<{
    requestId: string;
  }>;
};

function getRoleLabel(role: "boss" | "finance" | "cashier" | "applicant") {
  return {
    boss: "老板",
    finance: "财务",
    cashier: "出纳",
    applicant: "申请人"
  }[role];
}

export default async function RequestDetailPage({ params }: RequestDetailPageProps) {
  noStore();
  const session = await requirePageAccess("payment_requests");
  const { requestId } = await params;
  const role = session.role;
  const request = await getPaymentRequestById(requestId);

  if (!request) {
    notFound();
  }
  if (!canAccessOrganization(session, request.organization) || !canAccessOwningUser(session, request)) {
    notFound();
  }

  const executions = await getExecutionsByRequestId(requestId);
  const ledgerEntries = await getLedgerEntriesByRequestId(requestId);
  const approvalFlowProgress = getApprovalFlowProgress(request);
  const remainingAmount = request.amount - request.paidAmount;
  const fallbackAccounts = getBankAccountsForOrganizationCurrency(request.organization, request.currency);
  const defaultAccount = getDefaultBankAccountForOrganizationCurrency(request.organization, request.currency);
  const autoLedgerEntry = ledgerEntries.find((entry) => entry.sourceType === "payment_request_approval");
  const organizationRecord = getOrganizationByName(request.organization);
  const hasExecutionException = executions.some((item) => item.verificationStatus === "exception");
  const allExecutionsVerified = executions.length > 0 && executions.every((item) => item.verificationStatus === "verified");

  return (
    <main className="space-y-6">
      <header className="rounded-lg border border-line bg-white p-6">
        <div className="text-sm uppercase tracking-[0.18em] text-bronze">payment request detail</div>
        <h1 className="mt-2 text-3xl font-semibold">{request.id}</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-black/65">{request.title}</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${getStatusTone(request.status)}`}>
            {paymentStatusLabels[request.status]}
          </span>
          <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
            OCR：{ocrStatusLabels[request.ocrStatus]}
          </span>
          {["draft", "rejected"].includes(request.status) ? (
            <Link
              href={`/dashboard/requests/payments/${request.id}/edit` as Route}
              className="inline-flex rounded-full border border-line bg-paper px-3 py-1 text-xs font-medium text-ink"
            >
              编辑单据
            </Link>
          ) : null}
        </div>
      </header>

      <section className="rounded-lg border border-line bg-white p-6">
        <h2 className="text-lg font-semibold">闭环状态</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-5">
          {workflowSteps.map((step) => {
            const active = step.statuses.includes(request.status);
            return (
              <div
                key={step.key}
                className={`rounded-lg border px-4 py-4 ${active ? "border-emerald-200 bg-emerald-50" : "border-line bg-paper"}`}
              >
                <div className="text-xs uppercase tracking-[0.16em] text-black/40">{step.key}</div>
                <div className="mt-2 text-sm font-medium">{step.label}</div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-lg border border-line bg-white p-6">
        <h2 className="text-lg font-semibold">审批节点进度</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {approvalFlowProgress.length > 0 ? (
            approvalFlowProgress.map((node) => (
              <div
                key={node.id}
                className={`rounded-lg border px-4 py-4 ${
                  node.status === "completed"
                    ? "border-emerald-200 bg-emerald-50"
                    : node.status === "current"
                      ? "border-sky-200 bg-sky-50"
                      : node.status === "rejected"
                        ? "border-rose-200 bg-rose-50"
                        : "border-line bg-paper"
                }`}
              >
                <div className="text-xs uppercase tracking-[0.16em] text-black/40">
                  {node.status === "completed" ? "completed" : node.status === "current" ? "current" : node.status === "rejected" ? "rejected" : "pending"}
                </div>
                <div className="mt-2 text-sm font-medium">{node.name}</div>
                <div className="mt-2 text-sm text-black/60">{node.approver}</div>
              </div>
            ))
          ) : (
            <div className="rounded-md border border-line bg-paper px-4 py-4 text-sm text-black/60">当前单据没有可视化审批节点配置。</div>
          )}
        </div>
      </section>

      <section className="rounded-lg border border-line bg-white p-6">
        <h2 className="text-lg font-semibold">审批时间轴</h2>
        <div className="mt-5 space-y-4">
          {request.approvalHistory.map((item, index) => (
            <div key={item.id} className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className="h-3 w-3 rounded-full bg-ink" />
                {index < request.approvalHistory.length - 1 ? <div className="mt-1 h-full w-px bg-line" /> : null}
              </div>
              <div className="min-w-0 flex-1 rounded-md border border-line bg-paper px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">{item.action}</span>
                  <span className="text-xs text-black/45">{item.actedAt}</span>
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs ${
                    item.action.includes("自动入账") ? "bg-emerald-50 text-emerald-700" : "bg-white text-black/60"
                  }`}>{item.result}</span>
                </div>
                <div className="mt-2 text-sm text-black/70">
                  节点：{item.node ?? "-"} / 处理人：{item.actor}
                </div>
                <div className="mt-2 text-sm leading-6 text-black/70">{item.note}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.4fr_0.9fr]">
        <div className="rounded-lg border border-line bg-white p-6">
          <h2 className="text-lg font-semibold">单据基础信息</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Info label="所属组织" value={request.organization} />
            <Info label="所属项目/门店" value={request.projectName ?? "组织公共支出"} />
            <Info label="申请人" value={request.applicantName} />
            <Info label="申请日期" value={request.requestedAt} />
            <Info label="审批流模板" value={request.flowTemplateName ?? "-"} />
            <Info label="当前审批节点" value={request.currentApprovalNode ?? "-"} />
            <Info label="当前处理人" value={request.currentHandler ?? "-"} />
            <Info label="抄送" value={request.ccUsers.length > 0 ? request.ccUsers.join(" / ") : "-"} />
            <Info label="付款对象" value={request.paymentPartyName} />
            <Info label="付款对象类型" value={request.paymentPartyType} />
            <Info label="币种" value={request.currency} />
            <Info label="申请金额" value={formatMoney(request.amount, request.currency)} />
            <Info label="已付金额" value={formatMoney(request.paidAmount, request.currency)} />
            <Info label="剩余待付金额" value={formatMoney(remainingAmount, request.currency)} />
            <Info label="当前状态" value={paymentStatusLabels[request.status]} />
            <Info label="OCR 状态" value={ocrStatusLabels[request.ocrStatus]} />
          </div>

          <div className="mt-6">
            <div className="mb-2 text-sm font-medium text-black/55">用途 / 付款事由</div>
            <div className="rounded-md border border-line bg-paper px-4 py-3 text-sm leading-6">{request.purpose}</div>
          </div>
        </div>

        <div className="space-y-4">
          <section className="rounded-lg border border-line bg-white p-6">
            <h2 className="text-lg font-semibold">付款对象信息</h2>
            <div className="mt-4 space-y-3 text-sm">
              <Info label="开户行" value={request.paymentPartyBank} />
              <Info label="银行账号" value={request.paymentPartyAccount} />
              <Info label="是否内部往来" value={request.isInternal ? "是" : "否"} />
              <Info label="内部往来目标组织" value={request.internalTarget ?? "-"} />
            </div>
          </section>

          <section className="rounded-lg border border-line bg-white p-6">
            <h2 className="text-lg font-semibold">自动入账结果</h2>
            <div className="mt-4 space-y-3 text-sm">
              <Info label="自动入账状态" value={autoLedgerEntry ? "审批通过后已自动入账" : "尚未形成自动分录"} />
              <Info label="科目映射结果" value={autoLedgerEntry ? `${autoLedgerEntry.accountCode} / ${autoLedgerEntry.accountName}` : "-"} />
              <Info label="组织本位币" value={organizationRecord?.baseCurrency ?? request.currency} />
              <Info label="自动入账摘要" value={autoLedgerEntry?.summary ?? "-"} />
            </div>
          </section>

          <section className="rounded-lg border border-line bg-white p-6">
            <h2 className="text-lg font-semibold">附件留痕</h2>
            <div className="mt-4 space-y-3 text-sm">
              <AttachmentGroup label="发票附件" items={request.attachments.invoice} />
              <AttachmentGroup label="合同附件" items={request.attachments.contract} />
              <AttachmentGroup label="付款凭证" items={request.attachments.voucher} />
              <AttachmentGroup label="其他附件" items={request.attachments.other} />
            </div>
          </section>

          <section className="rounded-lg border border-line bg-white p-6">
            <h2 className="text-lg font-semibold">OCR 核对结果</h2>
            <div className="mt-4 space-y-3 text-sm">
              <Info label="识别单据类型" value={request.ocrResult?.documentType ?? "-"} />
              <Info label="匹配字段数" value={String(request.ocrResult?.matchedFields.length ?? 0)} />
              <Info label="异常字段数" value={String(request.ocrResult?.mismatchedFields.length ?? 0)} />
              <Info label="识别说明" value={request.ocrResult?.note ?? "尚未形成 OCR 结果"} />
            </div>
            {request.ocrResult ? (
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full border-collapse text-left text-sm">
                  <thead className="bg-paper">
                    <tr>
                      {["字段", "识别值", "结果"].map((label) => (
                        <th key={label} className="px-4 py-3 font-medium text-black/60">{label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(request.ocrResult.extracted).map(([key, value]) => {
                      const mismatched = request.ocrResult?.mismatchedFields.includes(key as never);
                      return (
                        <tr key={key} className="border-t border-line">
                          <td className="px-4 py-3">{key}</td>
                          <td className="px-4 py-3">{value}</td>
                          <td className="px-4 py-3">{mismatched ? "异常" : "一致"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : null}
          </section>
        </div>
      </section>

      <section className="rounded-lg border border-line bg-white p-6">
        <h2 className="text-lg font-semibold">财务执行记录</h2>
        {(request.status === "approved_waiting_payment" || request.status === "partially_paid") ? (
          <form action={recordPaymentExecutionAction} className="mb-6 rounded-lg border border-line bg-paper p-4">
            <input type="hidden" name="requestId" value={request.id} />
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <InlineSelect
                name="bankAccountName"
                label="付款银行账户"
                defaultValue={defaultAccount?.accountName ?? fallbackAccounts[0]?.accountName ?? ""}
                options={fallbackAccounts.map((item) => ({
                  value: item.accountName,
                  label: `${item.accountName} / ${item.bankName} / ${item.currency}${item.isDefault ? " / 默认" : ""}`
                }))}
              />
              <InlineField name="amount" label="执行金额" defaultValue={String(remainingAmount)} />
              <InlineField name="executedAt" label="付款日期" defaultValue={new Date().toISOString().slice(0, 10)} />
              <InlineField name="bankReference" label="银行流水号" defaultValue="" />
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <InlineField name="voucherFiles" label="付款凭证文件" defaultValue="" />
              <div className="rounded-md border border-dashed border-line bg-white px-4 py-3 text-sm text-black/55">
                凭证文件名用逗号分隔。前端只做登记和核对，不做复杂附件编辑。
              </div>
            </div>
            <div className="mt-4">
              <div className="text-sm font-medium text-black/70">付款说明</div>
              <textarea
                name="note"
                defaultValue={remainingAmount === request.amount ? "第一笔付款" : "补充付款"}
                className="mt-2 min-h-24 w-full rounded-md border border-line bg-white px-4 py-3 text-sm outline-none"
              />
            </div>
            <button className="mt-4 rounded-md bg-ink px-5 py-3 text-sm font-medium text-white">登记财务执行</button>
          </form>
        ) : null}
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead className="bg-paper">
              <tr>
                {["执行日期", "付款账户", "执行金额", "银行流水号", "付款凭证", "核对状态", "核对人", "说明", "动作"].map((label) => (
                  <th key={label} className="px-4 py-3 font-medium text-black/60">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {executions.map((execution) => (
                <tr key={execution.id} className="border-t border-line">
                  <td className="px-4 py-3">{execution.executedAt}</td>
                  <td className="px-4 py-3">{execution.bankAccountName}</td>
                  <td className="px-4 py-3">{formatMoney(execution.amount, execution.currency)}</td>
                  <td className="px-4 py-3">{execution.bankReference || "-"}</td>
                  <td className="px-4 py-3">{execution.voucherFiles.length > 0 ? execution.voucherFiles.join(" / ") : "-"}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                      execution.verificationStatus === "verified"
                        ? "bg-emerald-50 text-emerald-700"
                        : execution.verificationStatus === "exception"
                          ? "bg-rose-50 text-rose-700"
                          : "bg-amber-50 text-amber-700"
                    }`}>
                      {execution.verificationStatus === "verified" ? "已核对" : execution.verificationStatus === "exception" ? "核对异常" : "待核对"}
                    </span>
                  </td>
                  <td className="px-4 py-3">{execution.verifiedBy ?? execution.executorName}</td>
                  <td className="px-4 py-3">{execution.verificationNote || execution.note}</td>
                  <td className="px-4 py-3">
                    {role === "finance" && execution.verificationStatus !== "verified" ? (
                      <div className="flex flex-wrap gap-2">
                        <MiniExecutionVerifyForm
                          requestId={request.id}
                          executionId={execution.id}
                          action="verify"
                          label="核对通过"
                          defaultNote="付款回单、银行账户和申请金额核对一致。"
                        />
                        <MiniExecutionVerifyForm
                          requestId={request.id}
                          executionId={execution.id}
                          action="flag_exception"
                          label="标记异常"
                          tone="secondary"
                          defaultNote="付款执行与申请信息存在差异，待财务复核。"
                        />
                      </div>
                    ) : (
                      <span className="text-xs text-black/45">{execution.verifiedAt ? execution.verifiedAt.slice(0, 10) : "-"}</span>
                    )}
                  </td>
                </tr>
              ))}
              {executions.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-6 text-center text-black/45">
                    还没有财务执行记录
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border border-line bg-white p-6">
        <h2 className="text-lg font-semibold">总账沉淀结果</h2>
        {renderTransitionAction(request.id, request.status, role)}
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead className="bg-paper">
              <tr>
                {["来源类型", "业务日期", "科目编码", "科目名称", "本位币金额", "摘要"].map((label) => (
                  <th key={label} className="px-4 py-3 font-medium text-black/60">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ledgerEntries.map((entry) => (
                <tr key={entry.id} className="border-t border-line">
                  <td className="px-4 py-3">{entry.sourceType === "payment_request_approval" ? "审批自动入账" : "付款申请"}</td>
                  <td className="px-4 py-3">{entry.businessDate}</td>
                  <td className="px-4 py-3">{entry.accountCode}</td>
                  <td className="px-4 py-3">{entry.accountName}</td>
                  <td className="px-4 py-3">{formatMoney(entry.functionalAmount, "RUB")}</td>
                  <td className="px-4 py-3">{entry.summary}</td>
                </tr>
              ))}
              {ledgerEntries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-black/45">
                    还没有入账记录
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-lg border border-line bg-white p-6">
          <h2 className="text-lg font-semibold">当前处理区</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Info label="当前审批节点" value={request.currentApprovalNode ?? "-"} />
            <Info label="当前处理人" value={request.currentHandler ?? "-"} />
            <Info label="当前状态" value={paymentStatusLabels[request.status]} />
            <Info
              label="当前卡点"
              value={
                request.status === "ocr_pending" || request.status === "ocr_exception_pending_confirm"
                  ? "等待 OCR / 出纳确认"
                  : request.status === "processing"
                    ? "等待审批节点处理"
                    : request.status === "approved_waiting_payment" || request.status === "partially_paid"
                      ? "等待财务执行"
                      : request.status === "paid" && hasExecutionException
                        ? "等待财务异常复核"
                        : request.status === "paid" && allExecutionsVerified
                          ? "执行已核对"
                      : request.status === "paid" && autoLedgerEntry
                        ? "等待财务核对"
                        : request.status === "paid"
                          ? "等待自动分录确认"
                          : request.status === "rejected"
                          ? "等待申请人修改"
                          : autoLedgerEntry
                            ? "已自动入账"
                            : "-"
              }
            />
          </div>
          <div className="mt-6 rounded-md border border-line bg-paper px-4 py-4 text-sm leading-6 text-black/70">
            {request.status === "ocr_pending" && "当前单据正在 OCR 核对。确认一致后进入审批，发现问题可直接驳回。"}
            {request.status === "ocr_exception_pending_confirm" && "当前单据存在 OCR 异常。需要出纳写明异常说明后，才能继续审批。"}
            {request.status === "processing" && "当前单据正在审批中。处理前尽量留下明确意见。"}
            {request.status === "approved_waiting_payment" && "当前单据已审批通过，等待财务执行付款。"}
            {request.status === "partially_paid" && "当前单据已部分付款，可继续登记剩余执行记录。"}
            {request.status === "paid" && hasExecutionException && "当前单据付款已完成，但执行核对发现异常，需要财务复核并留痕。"}
            {request.status === "paid" && allExecutionsVerified && "当前单据付款执行和凭证核对均已完成。"}
            {request.status === "paid" && autoLedgerEntry && "当前单据付款已完成。系统已自动入账，这里只核对执行结果。"}
            {request.status === "paid" && !autoLedgerEntry && "当前单据付款已完成，但还没有检测到自动分录，需要先核对入账结果。"}
            {request.status === "rejected" && "当前单据已驳回，可退回草稿给申请人修改后重提。"}
            {autoLedgerEntry && "当前单据已自动入账并完成闭环。"}
          </div>
        </div>

        <div className="rounded-lg border border-line bg-white p-6">
          <h2 className="text-lg font-semibold">处理要求</h2>
          <ul className="mt-4 space-y-3 text-sm leading-6 text-black/65">
            <li>审批动作尽量带意见，避免后续只看到结果，看不到原因。</li>
            <li>OCR 异常必须留下说明，后续财务和出纳才能追溯。</li>
            <li>驳回、取消、退回草稿建议写清楚原因，减少来回沟通。</li>
            <li>财务执行和付款核对要和申请信息、账户信息、附件信息对得上。</li>
            <li>当前角色：{getRoleLabel(role)}，只显示当前角色应处理的动作。</li>
          </ul>
        </div>
      </section>

      <section className="rounded-lg border border-line bg-white p-6">
        <h2 className="text-lg font-semibold">审批与操作留痕</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead className="bg-paper">
              <tr>
                {["时间", "动作", "节点", "处理人", "结果", "说明"].map((label) => (
                  <th key={label} className="px-4 py-3 font-medium text-black/60">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {request.approvalHistory.map((item) => (
                <tr key={item.id} className="border-t border-line">
                  <td className="px-4 py-3">{item.actedAt}</td>
                  <td className="px-4 py-3">{item.action}</td>
                  <td className="px-4 py-3">{item.node ?? "-"}</td>
                  <td className="px-4 py-3">{item.actor}</td>
                  <td className="px-4 py-3">{item.result}</td>
                  <td className="px-4 py-3">{item.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function renderTransitionAction(requestId: string, status: string, role: "boss" | "finance" | "cashier" | "applicant") {
  if (status === "ocr_pending" && (role === "cashier" || role === "finance")) {
    return (
      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <TransitionForm requestId={requestId} action="ocr_match" label="OCR核对通过，进入审批" actor="系统" defaultNote="关键字段核对一致，进入审批。" />
        <TransitionForm requestId={requestId} action="ocr_flag_exception" label="标记OCR异常" tone="secondary" actor="出纳" defaultNote="OCR识别与关键字段不一致，转人工确认。" />
        <TransitionForm requestId={requestId} action="reject" label="驳回申请" tone="secondary" actor="审批人" defaultNote="OCR阶段发现信息问题，退回申请人修改。" />
        <TransitionForm requestId={requestId} action="cancel" label="取消申请" tone="secondary" actor="申请人" defaultNote="申请人主动取消本单据。" />
      </div>
    );
  }
  if (status === "ocr_exception_pending_confirm" && role === "cashier") {
    return (
      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <TransitionForm requestId={requestId} action="ocr_exception_confirm" label="出纳确认OCR异常，继续审批" actor="出纳" defaultNote="异常已人工复核，允许继续审批。" />
        <TransitionForm requestId={requestId} action="reject" label="驳回申请" tone="secondary" actor="出纳" defaultNote="OCR异常无法接受，退回申请人处理。" />
      </div>
    );
  }
  if (status === "processing" && (role === "boss" || role === "finance")) {
    return (
      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <TransitionForm requestId={requestId} action="approve" label="通过当前审批节点" actor="当前审批人" defaultNote="审批通过，同意继续流转。" />
        <TransitionForm requestId={requestId} action="reject" label="驳回申请" tone="secondary" actor="当前审批人" defaultNote="审批不同意，请申请人补充或修改。" />
      </div>
    );
  }
  if (status === "approved_waiting_payment" && role === "applicant") {
    return (
      <div className="mt-4 grid gap-4 xl:grid-cols-1">
        <TransitionForm requestId={requestId} action="cancel" label="取消申请" tone="secondary" actor="申请人" defaultNote="审批后取消，停止后续付款处理。" />
      </div>
    );
  }
  if (status === "rejected" && role === "applicant") {
    return (
      <div className="mt-4 grid gap-4 xl:grid-cols-1">
        <TransitionForm requestId={requestId} action="return_to_draft" label="退回修改为草稿" actor="申请人" defaultNote="退回草稿，准备修改后重新提交。" />
      </div>
    );
  }
  return null;
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-sm text-black/50">{label}</div>
      <div className="mt-1 text-sm font-medium">{value}</div>
    </div>
  );
}

function AttachmentGroup({ label, items }: { label: string; items: string[] }) {
  return (
    <div>
      <div className="text-black/50">{label}</div>
      <div className="mt-1">
        {items.length > 0 ? items.join(" / ") : "-"}
      </div>
    </div>
  );
}

function TransitionForm({
  requestId,
  action,
  label,
  tone = "primary",
  actor,
  defaultNote
}: {
  requestId: string;
  action: string;
  label: string;
  tone?: "primary" | "secondary";
  actor: string;
  defaultNote: string;
}) {
  return (
    <form action={transitionPaymentRequestAction} className="rounded-lg border border-line bg-paper p-4">
      <input type="hidden" name="requestId" value={requestId} />
      <input type="hidden" name="action" value={action} />
      <input type="hidden" name="actor" value={actor} />
      <div className="text-sm font-medium text-black/70">处理动作</div>
      <div className="mt-2 text-sm text-black/85">{label}</div>
      <div className="mt-4 text-sm font-medium text-black/70">处理意见</div>
      <textarea
        name="note"
        defaultValue={defaultNote}
        className="mt-2 min-h-24 w-full rounded-md border border-line bg-white px-4 py-3 text-sm outline-none"
      />
      <button
        type="submit"
        className={`mt-4 ${
          tone === "primary"
            ? "rounded-md bg-ink px-5 py-3 text-sm font-medium text-white"
            : "rounded-md border border-line bg-white px-5 py-3 text-sm font-medium text-ink"
        }`}
      >
        {label}
      </button>
    </form>
  );
}

function InlineField({ name, label, defaultValue }: { name: string; label: string; defaultValue: string }) {
  return (
    <div>
      <div className="text-sm font-medium text-black/70">{label}</div>
      <input
        name={name}
        defaultValue={defaultValue}
        className="mt-2 h-11 w-full rounded-md border border-line bg-white px-4 text-sm outline-none"
      />
    </div>
  );
}

function InlineSelect({
  name,
  label,
  defaultValue,
  options
}: {
  name: string;
  label: string;
  defaultValue: string;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div>
      <div className="text-sm font-medium text-black/70">{label}</div>
      <select
        name={name}
        defaultValue={defaultValue}
        className="mt-2 h-11 w-full rounded-md border border-line bg-white px-4 text-sm outline-none"
      >
        <option value="">请选择账户</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function MiniExecutionVerifyForm({
  requestId,
  executionId,
  action,
  label,
  tone = "primary",
  defaultNote
}: {
  requestId: string;
  executionId: string;
  action: "verify" | "flag_exception";
  label: string;
  tone?: "primary" | "secondary";
  defaultNote: string;
}) {
  return (
    <form action={verifyPaymentExecutionAction} className="inline-flex items-center gap-2">
      <input type="hidden" name="requestId" value={requestId} />
      <input type="hidden" name="executionId" value={executionId} />
      <input type="hidden" name="action" value={action} />
      <input type="hidden" name="note" value={defaultNote} />
      <button
        type="submit"
        className={
          tone === "primary"
            ? "rounded-md bg-ink px-3 py-2 text-xs font-medium text-white"
            : "rounded-md border border-line bg-white px-3 py-2 text-xs font-medium text-ink"
        }
      >
        {label}
      </button>
    </form>
  );
}
