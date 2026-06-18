import { notFound } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";

import { canAccessOwningUser, requirePageAccess } from "@/lib/auth";
import { canAccessOrganization } from "@/lib/access";
import { formatMoney, getPurchaseLedgers, getPurchaseRequestById } from "@/lib/demo-store";
import { transitionPurchaseRequestAction } from "@/app/dashboard/requests/purchases/actions";

type Props = {
  params: Promise<{ requestId: string }>;
};

export default async function PurchaseRequestDetailPage({ params }: Props) {
  noStore();
  const session = await requirePageAccess("purchase_requests");
  const { requestId } = await params;
  const request = await getPurchaseRequestById(requestId);
  if (!request) notFound();
  if (!canAccessOrganization(session, request.organization) || !canAccessOwningUser(session, { applicantName: request.applicantName })) {
    notFound();
  }
  const ledgers = (await getPurchaseLedgers()).filter((item) => item.purchaseRequestId === request.id);

  return (
    <main className="space-y-6">
      <header className="rounded-lg border border-line bg-white p-6">
        <div className="text-sm uppercase tracking-[0.18em] text-bronze">purchase detail</div>
        <h1 className="mt-2 text-3xl font-semibold">{request.id}</h1>
        <p className="mt-3 text-sm leading-6 text-black/65">{request.title}</p>
      </header>

      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-lg border border-line bg-white p-6">
          <h2 className="text-lg font-semibold">采购申请信息</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Info label="组织" value={request.organization} />
            <Info label="项目/门店" value={request.projectName ?? "公共采购"} />
            <Info label="申请人" value={request.applicantName} />
            <Info label="供应商" value={request.supplierName} />
            <Info label="采购类型" value={request.purchaseType} />
            <Info label="采购内容" value={request.content} />
            <Info label="规格" value={request.specification} />
            <Info label="数量" value={`${request.quantity} ${request.unit}`} />
            <Info label="单价" value={formatMoney(request.unitPrice, request.currency)} />
            <Info label="总金额" value={formatMoney(request.amount, request.currency)} />
            <Info label="预计到货" value={request.expectedArrivalDate} />
            <Info label="关联合同" value={request.linkedContractName ?? "-"} />
            <Info label="当前状态" value={getPurchaseStatusLabel(request.status)} />
            <Info label="当前处理人" value={request.currentHandler ?? "-"} />
          </div>
          <div className="mt-6 rounded-md border border-line bg-paper px-4 py-4 text-sm leading-6 text-black/70">{request.purpose}</div>
        </div>

        <div className="rounded-lg border border-line bg-white p-6">
          <h2 className="text-lg font-semibold">处理动作</h2>
          <div className="mt-1 text-sm text-black/55">这里只处理审批动作，采购台账由系统自动生成。</div>
          <div className="mt-4 space-y-4">
            {request.status === "processing" && (session.role === "boss" || session.role === "finance") ? (
              <>
                <ActionForm requestId={request.id} action="approve" label="审批通过并生成采购台账" defaultNote="采购申请通过，系统自动生成采购台账。" />
                <ActionForm requestId={request.id} action="reject" label="驳回采购申请" tone="secondary" defaultNote="采购申请信息不完整，退回修改。" />
              </>
            ) : null}
            {["draft", "submitted", "processing"].includes(request.status) && session.role === "applicant" ? (
              <ActionForm requestId={request.id} action="cancel" label="取消采购申请" tone="secondary" defaultNote="申请人取消当前采购申请。" />
            ) : null}
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-line bg-white p-6">
        <h2 className="text-lg font-semibold">采购台账</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead className="bg-paper">
              <tr>
                {["台账编号", "供应商", "采购类型", "金额", "状态", "说明"].map((label) => (
                  <th key={label} className="px-4 py-3 font-medium text-black/60">{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ledgers.map((row) => (
                <tr key={row.id} className="border-t border-line">
                  <td className="px-4 py-3">{row.id}</td>
                  <td className="px-4 py-3">{row.supplierName}</td>
                  <td className="px-4 py-3">{row.purchaseType}</td>
                  <td className="px-4 py-3">{formatMoney(row.amount, row.currency)}</td>
                  <td className="px-4 py-3">{row.status}</td>
                  <td className="px-4 py-3">{row.note}</td>
                </tr>
              ))}
              {ledgers.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-black/45">审批通过后自动生成采购台账</td></tr>
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
    <form action={transitionPurchaseRequestAction} className="rounded-lg border border-line bg-paper p-4">
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
