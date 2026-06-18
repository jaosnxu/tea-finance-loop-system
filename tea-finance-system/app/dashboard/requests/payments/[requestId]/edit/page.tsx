import { notFound } from "next/navigation";

import { canAccessOwningUser, requirePageAccess } from "@/lib/auth";
import { canAccessOrganization } from "@/lib/access";
import {
  getOrganizationConfigViewAsync,
  getPaymentFormTemplateSummaryAsync,
  getPaymentFormTemplateViewAsync,
  getPaymentPartyConfigViewAsync,
  getProjectConfigViewAsync,
  getPaymentRequestById
} from "@/lib/demo-store";
import { updatePaymentRequestDraftAction } from "@/app/dashboard/requests/payments/actions";
import type { FormFieldConfig } from "@/lib/types";

type EditPaymentRequestPageProps = {
  params: Promise<{
    requestId: string;
  }>;
};

export default async function EditPaymentRequestPage({ params }: EditPaymentRequestPageProps) {
  const session = await requirePageAccess("payment_requests");
  const { requestId } = await params;
  const request = await getPaymentRequestById(requestId);
  if (!request) {
    notFound();
  }
  if (!canAccessOrganization(session, request.organization) || !canAccessOwningUser(session, request)) {
    notFound();
  }

  const [organizations, paymentPartiesRaw, projects, formTemplate, summary] = await Promise.all([
    getOrganizationConfigViewAsync(),
    getPaymentPartyConfigViewAsync(),
    getProjectConfigViewAsync(),
    getPaymentFormTemplateViewAsync(),
    getPaymentFormTemplateSummaryAsync()
  ]);
  const activeOrganizations = organizations.filter((item) => item.isActive);
  const paymentParties = paymentPartiesRaw
    .filter((item) => item.isActive)
    .map((item) => ({
      value: item.name,
      label: `${item.name} / ${item.bankName}`
    }));
  const selectedOrganizationConfig = activeOrganizations.find((item) => item.displayName === request.organization) ?? null;
  const isImportOrganization = selectedOrganizationConfig?.settlementRole === "import";
  const selectedLibraryParty = paymentParties.find((item) => item.value === request.paymentPartyName) ?? null;
  return (
    <main className="space-y-6">
      <header className="rounded-lg border border-line bg-white p-6">
        <div className="text-sm uppercase tracking-[0.18em] text-bronze">edit payment request</div>
        <h1 className="mt-2 text-3xl font-semibold">编辑付款申请</h1>
        <p className="mt-3 max-w-4xl text-sm leading-6 text-black/65">
          当前单据状态为 {getPaymentRequestStatusLabel(request.status)}。这里会回填原字段，修改后可保存或重新提交。
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "单据编号", value: request.id },
            { label: "当前状态", value: getPaymentRequestStatusLabel(request.status) },
            { label: "表单字段", value: String(summary.totalFields) },
            { label: "必填字段", value: String(summary.requiredFields) }
          ].map((item) => (
          <div key={item.label} className="rounded-lg border border-line bg-white p-5">
            <div className="text-sm text-black/55">{item.label}</div>
            <div className="mt-3 text-xl font-semibold">{item.value}</div>
          </div>
        ))}
      </section>

      <form action={updatePaymentRequestDraftAction} className="rounded-lg border border-line bg-white p-6">
        <input type="hidden" name="requestId" value={request.id} />
        <h2 className="text-lg font-semibold">{formTemplate.name}</h2>
        <div className="mt-5 space-y-6">
          {formTemplate.sections.map((section) => {
            const fields = formTemplate.fields.filter(
              (field) =>
                field.enabled !== false &&
                field.section === section.id &&
                (field.name !== "currency" || isImportOrganization) &&
                (field.name !== "paymentPartyType" || (!selectedLibraryParty && !request.isInternal)) &&
                (field.name !== "internalTarget" || request.isInternal) &&
                (field.organizationScope == null ||
                  field.organizationScope.length === 0 ||
                  field.organizationScope.includes(request.organization))
            );
            if (fields.length === 0) return null;
            return (
              <section key={section.id}>
                <div className="border-b border-line pb-3">
                  <div className="text-base font-semibold">{section.label}</div>
                  {section.description ? <div className="mt-1 text-sm text-black/55">{section.description}</div> : null}
                </div>
                  <div className="mt-4 grid gap-5 md:grid-cols-2">
                  {fields.map((field) => (
                    <ConfiguredField
                      key={field.id}
                      field={field}
                      organizations={activeOrganizations
                        .map((item) => item.displayName)
                        .filter((name) => field.name !== "internalTarget" || name !== request.organization)}
                      paymentParties={paymentParties}
                      projects={projects
                        .filter((item) => item.isActive && item.organization === request.organization)
                        .map((item) => ({ value: item.name, label: `${item.organization} / ${item.name} / ${item.code}` }))}
                      selectedLibraryParty={selectedLibraryParty}
                      request={request}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
        {!isImportOrganization ? <input type="hidden" name="currency" value={request.currency || "RUB"} /> : null}

        <div className="mt-6 flex flex-wrap gap-3">
          <button name="submitMode" value="draft" className="rounded-md bg-ink px-5 py-3 text-sm font-medium text-white">
            保存修改
          </button>
          <button name="submitMode" value="submit" className="rounded-md border border-line bg-paper px-5 py-3 text-sm font-medium text-ink">
            重新提交审批
          </button>
        </div>
      </form>
    </main>
  );
}

function getPaymentRequestStatusLabel(status: string) {
  return {
    draft: "草稿",
    submitted: "已提交",
    ocr_pending: "OCR识别中",
    ocr_exception_pending_confirm: "OCR异常待确认",
    processing: "审批中",
    approved_waiting_payment: "待付款",
    partially_paid: "部分付款",
    paid: "已付款",
    rejected: "已驳回",
    cancelled: "已取消"
  }[status] ?? status;
}

function Label({ text }: { text: string }) {
  return <div className="text-sm font-medium text-black/70">{text}</div>;
}

function ConfiguredField({
  field,
  organizations,
  paymentParties,
  projects,
  selectedLibraryParty,
  request
}: {
  field: FormFieldConfig;
  organizations: string[];
  paymentParties: Array<{ value: string; label: string }>;
  projects: Array<{ value: string; label: string }>;
  selectedLibraryParty: { value: string; label: string } | null;
  request: Awaited<ReturnType<typeof getPaymentRequestById>>;
}) {
  if (!request) return null;
  const className = field.width === "full" ? "md:col-span-2" : "";
  const currentValue = getRequestFieldValue(request, field.name);
  const options = getFieldOptions(field, organizations, paymentParties, projects);

  if (field.type === "textarea") {
    return (
      <div className={className}>
        <Label text={`${field.label}${field.required ? " *" : ""}`} />
        <textarea
          name={field.name}
          required={field.required}
          defaultValue={String(currentValue ?? field.defaultValue ?? "")}
          className="mt-2 min-h-28 w-full rounded-md border border-line bg-white px-4 py-3 text-sm outline-none ring-0 placeholder:text-black/35"
          placeholder={field.placeholder}
        />
      </div>
    );
  }

  if (field.type === "select") {
    return (
      <div className={className}>
        <Label text={`${field.label}${field.required ? " *" : ""}`} />
        <select
          name={field.name}
          required={field.required}
          defaultValue={String(currentValue ?? "")}
          className="mt-2 h-11 w-full rounded-md border border-line bg-white px-4 text-sm outline-none"
        >
          <option value="">请选择</option>
          {options.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        {field.name === "paymentPartyName" ? (
          <div className="mt-2 text-xs leading-5 text-black/45">银行信息继续按资料库回填。</div>
        ) : null}
      </div>
    );
  }

  if (field.type === "attachment") {
    return (
      <div className={className}>
        <Label text={`${field.label}${field.required ? " *" : ""}`} />
        <div className="mt-2 rounded-md border border-dashed border-line bg-paper px-4 py-4 text-sm text-black/55">
          {Array.isArray(currentValue) && currentValue.length > 0 ? currentValue.join(" / ") : "上传区域"}
          <div className="mt-1 text-xs text-black/40">{field.note ?? "上传材料"}</div>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <Label text={`${field.label}${field.required ? " *" : ""}`} />
      <input
        name={field.name}
        type={field.type === "number" ? "number" : "text"}
        required={field.required}
        defaultValue={String(currentValue ?? field.defaultValue ?? "")}
        readOnly={
          field.name === "applicantName" ||
          Boolean(selectedLibraryParty && ["paymentPartyBank", "paymentPartyAccount"].includes(field.name))
        }
        className={`mt-2 h-11 w-full rounded-md border border-line px-4 text-sm outline-none placeholder:text-black/35 ${
          field.name === "applicantName" ||
          Boolean(selectedLibraryParty && ["paymentPartyBank", "paymentPartyAccount"].includes(field.name))
            ? "bg-paper text-black/70"
            : "bg-white"
        }`}
        placeholder={field.placeholder ?? ""}
      />
      {field.name === "applicantName" ? (
        <div className="mt-2 text-xs leading-5 text-black/45">系统默认带出，前台不需要填写。</div>
      ) : selectedLibraryParty && ["paymentPartyBank", "paymentPartyAccount"].includes(field.name) ? (
        <div className="mt-2 text-xs leading-5 text-black/45">来自付款对象资料库，只用于核对。</div>
      ) : null}
    </div>
  );
}

function getFieldOptions(
  field: FormFieldConfig,
  organizations: string[],
  paymentParties: Array<{ value: string; label: string }>,
  projects: Array<{ value: string; label: string }>
) {
  if (field.name === "organization") {
    return organizations.map((item) => [item, item] as [string, string]);
  }
  if (field.name === "projectName") {
    return projects.map((item) => [item.value, item.label] as [string, string]);
  }
  if (field.name === "paymentPartyName") {
    return paymentParties.map((item) => [item.value, item.label] as [string, string]);
  }
  return (field.options ?? []).map((item) => [item.value, item.label] as [string, string]);
}

function getRequestFieldValue(request: NonNullable<Awaited<ReturnType<typeof getPaymentRequestById>>>, fieldName: string) {
  const mapping: Record<string, unknown> = {
    title: request.title,
    applicantName: request.applicantName,
    organization: request.organization,
    projectName: request.projectName ?? "",
    paymentPartyType: request.paymentPartyType,
    paymentPartyName: request.paymentPartyName,
    paymentPartyBank: request.paymentPartyBank,
    paymentPartyAccount: request.paymentPartyAccount,
    currency: request.currency,
    amount: request.amount,
    isInternal: String(request.isInternal),
    internalTarget: request.internalTarget ?? "",
    purpose: request.purpose,
    invoiceAttachment: request.attachments.invoice,
    contractAttachment: request.attachments.contract,
    voucherAttachment: request.attachments.voucher,
    otherAttachment: request.attachments.other
  };
  return mapping[fieldName];
}
