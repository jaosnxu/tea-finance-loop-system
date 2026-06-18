import { notFound } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";

import { canAccessOwningUser, requirePageAccess } from "@/lib/auth";
import { canAccessOrganization } from "@/lib/access";
import { formatMoney, getContractApprovalById, getContractLedgers } from "@/lib/demo-store";
import { transitionContractApprovalAction } from "@/app/dashboard/requests/contracts/actions";

type Props = {
  params: Promise<{ requestId: string }>;
};

export default async function ContractApprovalDetailPage({ params }: Props) {
  noStore();
  const session = await requirePageAccess("contract_requests");
  const { requestId } = await params;
  const request = await getContractApprovalById(requestId);
  if (!request) notFound();
  if (!canAccessOrganization(session, request.organization) || !canAccessOwningUser(session, { applicantName: request.applicantName })) {
    notFound();
  }
  const ledgers = (await getContractLedgers()).filter((item) => item.contractRequestId === request.id);

  return (
    <main className="space-y-6">
      <header className="rounded-lg border border-line bg-white p-6">
        <div className="text-sm uppercase tracking-[0.18em] text-bronze">contract detail</div>
        <h1 className="mt-2 text-3xl font-semibold">{request.id}</h1>
        <p className="mt-3 text-sm leading-6 text-black/65">{request.contractName}</p>
      </header>

      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-lg border border-line bg-white p-6">
          <h2 className="text-lg font-semibold">合同审批信息</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Info label="组织" value={request.organization} />
            <Info label="项目/门店" value={request.projectName ?? "公共合同"} />
            <Info label="申请人" value={request.applicantName} />
            <Info label="合同编号" value={request.contractNo} />
            <Info label="合同类型" value={request.contractType} />
            <Info label="相对方" value={request.counterpartyName} />
            <Info label="币种" value={request.currency} />
            <Info label="合同金额" value={formatMoney(request.amount, request.currency)} />
            <Info label="签订日期" value={request.signedAt} />
            <Info label="生效日期" value={request.effectiveDate} />
            <Info label="到期日期" value={request.expiryDate} />
            <Info label="结算方式" value={request.settlementMethod} />
            <Info label="OCR状态" value={getOcrStatusLabel(request.ocrStatus)} />
            <Info label="当前处理人" value={request.currentHandler ?? "-"} />
          </div>
          <div className="mt-6 rounded-md border border-line bg-paper px-4 py-4 text-sm leading-6 text-black/70">{request.summary}</div>
          <div className="mt-4 rounded-md border border-line bg-paper px-4 py-4 text-sm leading-6 text-black/70">
            付款条款：{request.paymentTerms}
          </div>
        </div>

        <div className="rounded-lg border border-line bg-white p-6">
          <h2 className="text-lg font-semibold">处理动作</h2>
          <div className="mt-1 text-sm text-black/55">这里只处理审批动作，合同台账由系统自动生成。</div>
          <div className="mt-4 space-y-4">
            {request.status === "processing" && (session.role === "boss" || session.role === "finance") ? (
              <>
                <ActionForm requestId={request.id} action="approve" label="审批通过并生成合同台账" defaultNote="合同审批通过，系统自动生成合同台账。" />
                <ActionForm requestId={request.id} action="reject" label="驳回合同审批" tone="secondary" defaultNote="合同信息需补充，退回修改。" />
              </>
            ) : null}
            {["draft", "submitted", "ocr_pending", "processing"].includes(request.status) && session.role === "applicant" ? (
              <ActionForm requestId={request.id} action="cancel" label="取消合同审批" tone="secondary" defaultNote="申请人取消当前合同审批。" />
            ) : null}
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-line bg-white p-6">
        <h2 className="text-lg font-semibold">合同台账</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead className="bg-paper">
              <tr>
                {["台账编号", "合同编号", "相对方", "金额", "生效", "到期", "状态"].map((label) => (
                  <th key={label} className="px-4 py-3 font-medium text-black/60">{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ledgers.map((row) => (
                <tr key={row.id} className="border-t border-line">
                  <td className="px-4 py-3">{row.id}</td>
                  <td className="px-4 py-3">{row.contractNo}</td>
                  <td className="px-4 py-3">{row.counterpartyName}</td>
                  <td className="px-4 py-3">{formatMoney(row.amount, row.currency)}</td>
                  <td className="px-4 py-3">{row.effectiveDate}</td>
                  <td className="px-4 py-3">{row.expiryDate}</td>
                  <td className="px-4 py-3">{row.status}</td>
                </tr>
              ))}
              {ledgers.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-6 text-center text-black/45">审批通过后自动生成合同台账</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><div className="text-sm text-black/50">{label}</div><div className="mt-1 text-sm font-medium">{value}</div></div>;
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

function ActionForm({
  requestId,
  action,
  label,
  defaultNote,
  tone = "primary"
}: {
  requestId: string;
  action: "approve" | "reject" | "cancel";
  label: string;
  defaultNote: string;
  tone?: "primary" | "secondary";
}) {
  return (
    <form action={transitionContractApprovalAction} className="rounded-lg border border-line bg-paper p-4">
      <input type="hidden" name="requestId" value={requestId} />
      <input type="hidden" name="action" value={action} />
      <div className="text-sm font-medium text-black/70">{label}</div>
      <textarea name="note" defaultValue={defaultNote} className="mt-3 min-h-24 w-full rounded-md border border-line bg-white px-4 py-3 text-sm outline-none" />
      <button className={tone === "primary" ? "mt-4 rounded-md bg-ink px-5 py-3 text-sm font-medium text-white" : "mt-4 rounded-md border border-line bg-white px-5 py-3 text-sm font-medium text-ink"}>
        {label}
      </button>
    </form>
  );
}
