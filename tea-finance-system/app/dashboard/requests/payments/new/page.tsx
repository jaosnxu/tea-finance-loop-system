import {
  getBankAccountConfigViewAsync,
  getOrganizationConfigViewAsync,
  getPaymentFormTemplateSummaryAsync,
  getPaymentFormTemplateViewAsync,
  getPaymentPartyConfigViewAsync,
  getProjectConfigViewAsync
} from "@/lib/demo-store";
import { PaymentRequestForm } from "@/app/dashboard/requests/payments/new/payment-request-form";

export default async function NewPaymentRequestPage() {
  const [organizations, paymentParties, bankAccounts, projects, formTemplate, summary] = await Promise.all([
    getOrganizationConfigViewAsync(),
    getPaymentPartyConfigViewAsync(),
    getBankAccountConfigViewAsync(),
    getProjectConfigViewAsync(),
    getPaymentFormTemplateViewAsync(),
    getPaymentFormTemplateSummaryAsync()
  ]);
  const activeOrganizations = organizations.filter((item) => item.isActive).map((item) => item.displayName);
  return (
    <main className="space-y-6">
      <header className="rounded-lg border border-line bg-white p-6">
        <div className="text-sm uppercase tracking-[0.18em] text-bronze">new payment request</div>
        <h1 className="mt-2 text-3xl font-semibold">新建付款申请</h1>
        <p className="mt-3 max-w-4xl text-sm leading-6 text-black/65">
          第一阶段先用演示数据模拟发起页。字段设计按 V1 主闭环收口，重点覆盖组织、付款对象、金额、附件、OCR 和后续财务执行需要的信息。
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "表单字段", value: summary.totalFields },
          { label: "必填字段", value: summary.requiredFields },
          { label: "附件字段", value: summary.attachmentFields },
          { label: "表单分区", value: summary.sectionCount }
        ].map((item) => (
          <div key={item.label} className="rounded-lg border border-line bg-white p-5">
            <div className="text-sm text-black/55">{item.label}</div>
            <div className="mt-3 text-2xl font-semibold">{item.value}</div>
          </div>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.45fr_0.75fr]">
        <PaymentRequestForm
          activeOrganizations={organizations
            .filter((item) => item.isActive)
            .map((item) => ({
              value: item.displayName,
              label: item.displayName,
              baseCurrency: item.baseCurrency,
              taxLabel: item.taxLabel,
              settlementRole: item.settlementRole,
              enableMultiCurrency: item.enableMultiCurrency,
              enableExchangeRate: item.enableExchangeRate,
              allowedCurrencies: item.allowedCurrencies
            }))}
          paymentParties={paymentParties.map((item) => ({
            value: item.name,
            label: `${item.name} / ${item.bankName}`,
            type: item.type,
            organizationScope: item.organizationScope,
            bankName: item.bankName,
            bankAccount: item.bankAccount
          }))}
          bankAccounts={bankAccounts.map((item) => ({
            value: item.accountName,
            label: `${item.organization} / ${item.accountName} / ${item.bankName} / ${item.currency}`,
            organization: item.organization,
            currency: item.currency,
            isDefault: item.isDefault
          }))}
          projects={projects
            .filter((item) => item.isActive)
            .map((item) => ({
              value: item.name,
              label: `${item.organization} / ${item.name} / ${item.code}`,
              organization: item.organization
            }))}
          formTemplate={formTemplate}
        />

        <div className="space-y-6">
          <section className="rounded-lg border border-line bg-white p-6">
            <h2 className="text-lg font-semibold">提交后状态</h2>
            <ol className="mt-4 space-y-3 text-sm leading-6 text-black/65">
              <li>1. 进入申请状态并生成单据编号。</li>
              <li>2. OCR 自动识别发票、合同、凭证并比对关键字段。</li>
              <li>3. 异常时转出纳确认，正常则继续审批。</li>
              <li>4. 审批通过后进入财务执行，支持分批付款。</li>
              <li>5. 付清后进入总账，最终进入老板报表视图。</li>
            </ol>
          </section>

          <section className="rounded-lg border border-line bg-white p-6">
            <h2 className="text-lg font-semibold">V1 表单原则</h2>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-black/65">
              <li>字段先按俄区财务场景预留，当前用中文给你看。</li>
              <li>组织和税务口径来自后台配置，不写死。</li>
              <li>组件宽度按俄文长度预留，不做窄字段。</li>
              <li>字段分区、字段类型、必填规则、选项，已经开始从配置对象读取。</li>
            </ul>
          </section>
        </div>
      </section>
    </main>
  );
}
