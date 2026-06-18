import type { PageAccessKey, RoleConfigRecord, UserAccountRecord } from "@/lib/types";

export const pageAccessLabels: Record<PageAccessKey, string> = {
  dashboard: "经营总览",
  business_center: "业务单据",
  finance_center: "财务与结算",
  master_data_center: "门店与组织",
  rules_center: "规则与配置",
  system_center: "系统与权限",
  approvals: "审批中心",
  ocr_workbench: "OCR核对",
  payment_requests: "付款申请",
  purchase_requests: "采购申请",
  contract_requests: "合同审批",
  payment_execution: "付款执行",
  ledger: "总账",
  reports: "经营报表",
  settings: "系统设置",
  settings_organization: "组织与税务配置",
  settings_flows: "审批流配置",
  settings_forms: "表单配置",
  settings_ocr_rules: "OCR 规则配置",
  settings_bank_accounts: "银行账户配置",
  settings_exchange_rates: "汇率配置",
  settings_ledger_mappings: "总账科目映射",
  settings_payment_parties: "付款对象资料库",
  settings_access: "权限与账号",
  settings_master_data: "主数据体系"
};

export const configPermissionLabels = {
  organizations: "组织与税务配置",
  masterData: "主数据体系",
  flows: "审批流配置",
  forms: "表单配置",
  ocrRules: "OCR 规则配置",
  bankAccounts: "银行账户配置",
  exchangeRates: "汇率配置",
  ledgerMappings: "总账科目映射",
  paymentParties: "付款对象资料库",
  access: "权限与账号"
} as const;

export const approvalPermissionLabels = {
  approve: "审批通过",
  reject: "驳回",
  returnToDraft: "退回修改",
  confirmOcr: "确认 OCR 异常",
  executePayment: "登记付款执行",
  cancelOwnRequest: "取消本人申请"
} as const;

export function SectionCard({
  title,
  children
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-line bg-white">
      <div className="border-b border-line px-6 py-4">
        <h2 className="text-lg font-semibold">{title}</h2>
      </div>
      <div className="p-6">{children}</div>
    </section>
  );
}

export function RoleBadge({ role }: { role: RoleConfigRecord | undefined }) {
  return (
    <span className="inline-flex rounded-full border border-line bg-paper px-3 py-1 text-xs font-medium text-ink">
      {role?.label ?? "-"}
    </span>
  );
}

export function UserStatusBadge({ user }: { user: UserAccountRecord }) {
  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
        user.isActive ? "bg-emerald-100 text-emerald-800" : "bg-stone-200 text-stone-700"
      }`}
    >
      {user.isActive ? "启用" : "停用"}
    </span>
  );
}
