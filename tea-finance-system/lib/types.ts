export type ApprovalStatus =
  | "draft"
  | "submitted"
  | "processing"
  | "rejected"
  | "approved"
  | "cancelled"
  | "closed";

export type PaymentRequestStatus =
  | "draft"
  | "submitted"
  | "ocr_pending"
  | "ocr_exception_pending_confirm"
  | "processing"
  | "approved_waiting_payment"
  | "partially_paid"
  | "paid"
  | "rejected"
  | "cancelled";

export type OrganizationTaxMode = "VAT" | "USN" | "OTHER";

export type OrganizationConfigRecord = {
  id: string;
  displayName: string;
  legalNameRu: string;
  legalForm: "OOO" | "IP" | "AO" | "OTHER";
  taxMode: OrganizationTaxMode;
  taxLabel: string;
  baseCurrency: "RUB" | "CNY" | "USD";
  enableMultiCurrency: boolean;
  enableExchangeRate: boolean;
  allowedCurrencies: Array<"RUB" | "CNY" | "USD">;
  bankAccountCount: number;
  projectCount: number;
  departmentCount: number;
  isActive: boolean;
  includeInGroupReport: boolean;
  settlementRole: "operating" | "import" | "brand" | "franchise" | "other";
};

export type DepartmentConfigRecord = {
  id: string;
  name: string;
  organization: string;
  parentDepartmentId: string | null;
  managerPersonId: string | null;
  isActive: boolean;
};

export type ProjectConfigRecord = {
  id: string;
  name: string;
  organization: string;
  type: "store" | "project" | "shared";
  code: string;
  managerPersonId: string | null;
  isActive: boolean;
};

export type PersonConfigRecord = {
  id: string;
  displayName: string;
  organization: string;
  departmentId: string | null;
  title: string;
  managerPersonId: string | null;
  phone: string;
  email: string;
  isActive: boolean;
};

export type ApprovalFlowNode = {
  id: string;
  name: string;
  approverType: "role" | "person" | "manager";
  approverValue: string;
  ccList: string[];
  order: number;
  actionOnPass: string;
};

export type ApprovalFlowTemplate = {
  id: string;
  name: string;
  requestType: "payment" | "purchase" | "contract" | "seal";
  enabled: boolean;
  organizationScope: string[];
  amountRule: string;
  currencyScope: Array<"RUB" | "CNY" | "USD">;
  nodes: ApprovalFlowNode[];
};

export type FormFieldType = "text" | "number" | "textarea" | "select" | "attachment";

export type FormFieldConfig = {
  id: string;
  name: string;
  label: string;
  type: FormFieldType;
  enabled?: boolean;
  organizationScope?: string[];
  required: boolean;
  placeholder?: string;
  defaultValue?: string;
  width: "half" | "full";
  options?: Array<{
    value: string;
    label: string;
  }>;
  note?: string;
  section: "basic" | "party" | "finance" | "purpose" | "attachments";
};

export type FormTemplateConfig = {
  id: string;
  name: string;
  requestType: "payment" | "purchase" | "contract" | "seal";
  enabled: boolean;
  sections: Array<{
    id: FormFieldConfig["section"];
    label: string;
    description?: string;
  }>;
  fields: FormFieldConfig[];
};

export type BankAccountConfigRecord = {
  id: string;
  organization: string;
  accountName: string;
  bankName: string;
  accountNumber: string;
  currency: "RUB" | "CNY" | "USD";
  balance: number;
  isDefault: boolean;
  isActive: boolean;
};

export type ExchangeRateConfigRecord = {
  id: string;
  organizationScope: string[];
  fromCurrency: "RUB" | "CNY" | "USD";
  toCurrency: "RUB" | "CNY" | "USD";
  rate: number;
  effectiveDate: string;
  isActive: boolean;
};

export type LedgerAccountMappingRecord = {
  id: string;
  organizationScope: string[];
  scenario: "internal_transfer" | "import_foreign_payment" | "standard_payment";
  accountCode: string;
  accountName: string;
  isActive: boolean;
};

export type PaymentPartyConfigRecord = {
  id: string;
  name: string;
  type: "supplier" | "customer" | "internal" | "person";
  organizationScope?: string[];
  bankName: string;
  bankAccount: string;
  contactName: string;
  phone: string;
  isActive: boolean;
};

export type UserRoleKey = "boss" | "finance" | "cashier" | "applicant";

export type PageAccessKey =
  | "dashboard"
  | "business_center"
  | "finance_center"
  | "master_data_center"
  | "rules_center"
  | "system_center"
  | "approvals"
  | "ocr_workbench"
  | "payment_requests"
  | "purchase_requests"
  | "contract_requests"
  | "payment_execution"
  | "ledger"
  | "reports"
  | "settings"
  | "settings_organization"
  | "settings_flows"
  | "settings_forms"
  | "settings_ocr_rules"
  | "settings_bank_accounts"
  | "settings_exchange_rates"
  | "settings_ledger_mappings"
  | "settings_payment_parties"
  | "settings_access"
  | "settings_master_data";

export type ConfigPermissionSet = {
  organizations: boolean;
  masterData: boolean;
  flows: boolean;
  forms: boolean;
  ocrRules: boolean;
  bankAccounts: boolean;
  exchangeRates: boolean;
  ledgerMappings: boolean;
  paymentParties: boolean;
  access: boolean;
};

export type OcrFieldKey =
  | "amount"
  | "companyName"
  | "bankAccount"
  | "documentDate"
  | "contractSubject";

export type OcrRuleConfigRecord = {
  id: string;
  name: string;
  documentType: "invoice" | "contract" | "voucher";
  organizationScope: string[];
  requiredFields: OcrFieldKey[];
  blockOnMismatch: boolean;
  enabled: boolean;
};

export type ApprovalPermissionSet = {
  approve: boolean;
  reject: boolean;
  returnToDraft: boolean;
  confirmOcr: boolean;
  executePayment: boolean;
  cancelOwnRequest: boolean;
};

export type RoleConfigRecord = {
  id: UserRoleKey;
  label: string;
  description: string;
  pageAccess: PageAccessKey[];
  dataScope: "all" | "organization" | "own";
  configPermissions: ConfigPermissionSet;
  approvalPermissions: ApprovalPermissionSet;
};

export type UserAccountRecord = {
  id: string;
  username: string;
  password: string;
  displayName: string;
  role: UserRoleKey;
  organizationScope: string[];
  isActive: boolean;
};
