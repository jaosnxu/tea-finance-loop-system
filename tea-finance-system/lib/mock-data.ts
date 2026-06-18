import type {
  ApprovalFlowTemplate,
  BankAccountConfigRecord,
  DepartmentConfigRecord,
  ExchangeRateConfigRecord,
  FormTemplateConfig,
  LedgerAccountMappingRecord,
  OcrRuleConfigRecord,
  OrganizationConfigRecord,
  PaymentPartyConfigRecord,
  PaymentRequestStatus,
  PersonConfigRecord,
  ProjectConfigRecord,
  RoleConfigRecord,
  UserAccountRecord
} from "@/lib/types";

export type PaymentRequestRecord = {
  id: string;
  title: string;
  organization: string;
  projectName: string | null;
  applicantName: string;
  requestedAt: string;
  purpose: string;
  amount: number;
  paidAmount: number;
  currency: "RUB" | "CNY" | "USD";
  status: PaymentRequestStatus;
  paymentPartyName: string;
  paymentPartyType: "supplier" | "customer" | "internal" | "person";
  paymentPartyBank: string;
  paymentPartyAccount: string;
  isInternal: boolean;
  internalTarget: string | null;
  flowTemplateId: string | null;
  flowTemplateName: string | null;
  currentApprovalNode: string | null;
  currentHandler: string | null;
  ccUsers: string[];
  approvalHistory: Array<{
    id: string;
    action: string;
    node: string | null;
    actor: string;
    result: string;
    note: string;
    actedAt: string;
  }>;
  ocrStatus: "not_started" | "processing" | "matched" | "exception_pending_confirm" | "confirmed_exception";
  ocrResult: {
    documentType: "invoice" | "contract" | "voucher";
    matchedFields: Array<"amount" | "companyName" | "bankAccount" | "documentDate" | "contractSubject">;
    mismatchedFields: Array<"amount" | "companyName" | "bankAccount" | "documentDate" | "contractSubject">;
    extracted: Record<string, string>;
    note: string;
  } | null;
  attachments: {
    invoice: string[];
    contract: string[];
    voucher: string[];
    other: string[];
  };
};

export type PaymentExecutionRecord = {
  id: string;
  paymentRequestId: string;
  bankAccountName: string;
  amount: number;
  currency: "RUB" | "CNY" | "USD";
  executedAt: string;
  bankReference: string;
  voucherFiles: string[];
  note: string;
  executorName: string;
  verificationStatus: "pending" | "verified" | "exception";
  verificationNote: string;
  verifiedBy: string | null;
  verifiedAt: string | null;
};

export type PurchaseRequestRecord = {
  id: string;
  title: string;
  organization: string;
  projectName: string | null;
  applicantName: string;
  requestedAt: string;
  supplierName: string;
  purchaseType: string;
  content: string;
  specification: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  currency: "RUB" | "CNY" | "USD";
  amount: number;
  purpose: string;
  expectedArrivalDate: string;
  requiresPayment: boolean;
  requiresInventory: boolean;
  linkedContractName: string | null;
  status: "draft" | "submitted" | "processing" | "approved" | "ledger_created" | "rejected" | "cancelled";
  currentApprovalNode: string | null;
  currentHandler: string | null;
  approvalHistory: Array<{
    id: string;
    action: string;
    node: string | null;
    actor: string;
    result: string;
    note: string;
    actedAt: string;
  }>;
  attachments: string[];
};

export type PurchaseLedgerRecord = {
  id: string;
  purchaseRequestId: string;
  organization: string;
  supplierName: string;
  purchaseType: string;
  amount: number;
  currency: "RUB" | "CNY" | "USD";
  createdAt: string;
  status: "open" | "linked_payment" | "closed";
  note: string;
};

export type ContractApprovalRecord = {
  id: string;
  title: string;
  organization: string;
  projectName: string | null;
  applicantName: string;
  requestedAt: string;
  contractName: string;
  contractNo: string;
  contractType: string;
  counterpartyName: string;
  currency: "RUB" | "CNY" | "USD";
  amount: number;
  signedAt: string;
  effectiveDate: string;
  expiryDate: string;
  paymentTerms: string;
  settlementMethod: string;
  summary: string;
  status: "draft" | "submitted" | "ocr_pending" | "ocr_exception_pending_confirm" | "processing" | "approved" | "ledger_created" | "rejected" | "cancelled";
  currentApprovalNode: string | null;
  currentHandler: string | null;
  ocrStatus: "not_started" | "processing" | "matched" | "exception_pending_confirm" | "confirmed_exception";
  approvalHistory: Array<{
    id: string;
    action: string;
    node: string | null;
    actor: string;
    result: string;
    note: string;
    actedAt: string;
  }>;
  attachments: string[];
};

export type ContractLedgerRecord = {
  id: string;
  contractRequestId: string;
  organization: string;
  contractName: string;
  contractNo: string;
  counterpartyName: string;
  amount: number;
  currency: "RUB" | "CNY" | "USD";
  effectiveDate: string;
  expiryDate: string;
  status: "active" | "expired" | "cancelled";
  note: string;
};

export type LedgerEntryRecord = {
  id: string;
  paymentRequestId: string;
  sourceType: string;
  sourceNo: string;
  organization: string;
  projectName: string | null;
  businessDate: string;
  currency: "RUB" | "CNY" | "USD";
  originalAmount: number;
  exchangeRate: number;
  functionalAmount: number;
  direction: "outflow" | "inflow";
  accountCode: string;
  accountName: string;
  summary: string;
};

export const paymentStatusLabels: Record<PaymentRequestStatus, string> = {
  draft: "草稿",
  submitted: "已提交",
  ocr_pending: "OCR识别中",
  ocr_exception_pending_confirm: "OCR异常待确认",
  processing: "审批中",
  approved_waiting_payment: "已通过待付款",
  partially_paid: "部分付款",
  paid: "已付款",
  rejected: "已驳回",
  cancelled: "已取消"
};

export const ocrStatusLabels: Record<PaymentRequestRecord["ocrStatus"], string> = {
  not_started: "未启动",
  processing: "识别中",
  matched: "识别一致",
  exception_pending_confirm: "异常待确认",
  confirmed_exception: "异常已确认"
};

export const workflowSteps: Array<{
  key: string;
  label: string;
  statuses: PaymentRequestStatus[];
}> = [
  { key: "submitted", label: "申请提交", statuses: ["submitted", "ocr_pending", "ocr_exception_pending_confirm", "processing", "approved_waiting_payment", "partially_paid", "paid"] },
  { key: "ocr", label: "OCR核对", statuses: ["ocr_pending", "ocr_exception_pending_confirm", "processing", "approved_waiting_payment", "partially_paid", "paid"] },
  { key: "approval", label: "审批通过", statuses: ["approved_waiting_payment", "partially_paid", "paid"] },
  { key: "payment", label: "财务执行", statuses: ["partially_paid", "paid"] },
  { key: "ledger", label: "系统自动入账", statuses: ["approved_waiting_payment", "partially_paid", "paid"] }
] as const;

export const organizations: OrganizationConfigRecord[] = [
  {
    id: "org-brand",
    displayName: "品牌管理公司",
    legalNameRu: "OOO Tea Brand Management",
    legalForm: "OOO",
    taxMode: "VAT",
    taxLabel: "НДС",
    baseCurrency: "RUB",
    enableMultiCurrency: false,
    enableExchangeRate: false,
    allowedCurrencies: ["RUB"],
    bankAccountCount: 3,
    projectCount: 2,
    departmentCount: 4,
    isActive: true,
    includeInGroupReport: true,
    settlementRole: "brand"
  },
  {
    id: "org-import",
    displayName: "进出口公司",
    legalNameRu: "OOO Tea Import Export",
    legalForm: "OOO",
    taxMode: "USN",
    taxLabel: "УСН",
    baseCurrency: "RUB",
    enableMultiCurrency: true,
    enableExchangeRate: true,
    allowedCurrencies: ["RUB", "CNY", "USD"],
    bankAccountCount: 4,
    projectCount: 1,
    departmentCount: 3,
    isActive: true,
    includeInGroupReport: true,
    settlementRole: "import"
  },
  {
    id: "org-store-kzn",
    displayName: "喀山直营店主体",
    legalNameRu: "OOO Tea Kazan Store",
    legalForm: "OOO",
    taxMode: "USN",
    taxLabel: "УСН",
    baseCurrency: "RUB",
    enableMultiCurrency: false,
    enableExchangeRate: false,
    allowedCurrencies: ["RUB"],
    bankAccountCount: 2,
    projectCount: 1,
    departmentCount: 2,
    isActive: true,
    includeInGroupReport: true,
    settlementRole: "operating"
  },
  {
    id: "org-store-spb",
    displayName: "圣彼得堡直营店主体",
    legalNameRu: "OOO Tea SPB Store",
    legalForm: "OOO",
    taxMode: "OTHER",
    taxLabel: "其他税制",
    baseCurrency: "RUB",
    enableMultiCurrency: false,
    enableExchangeRate: false,
    allowedCurrencies: ["RUB"],
    bankAccountCount: 2,
    projectCount: 1,
    departmentCount: 2,
    isActive: true,
    includeInGroupReport: true,
    settlementRole: "operating"
  },
  {
    id: "org-franchise",
    displayName: "加盟结算主体",
    legalNameRu: "IP Tea Franchise",
    legalForm: "IP",
    taxMode: "USN",
    taxLabel: "УСН",
    baseCurrency: "RUB",
    enableMultiCurrency: false,
    enableExchangeRate: false,
    allowedCurrencies: ["RUB"],
    bankAccountCount: 1,
    projectCount: 3,
    departmentCount: 1,
    isActive: false,
    includeInGroupReport: false,
    settlementRole: "franchise"
  }
];

export const departments: DepartmentConfigRecord[] = [
  {
    id: "dept-brand-finance",
    name: "品牌财务部",
    organization: "品牌管理公司",
    parentDepartmentId: null,
    managerPersonId: "person-finance-director",
    isActive: true
  },
  {
    id: "dept-brand-ops",
    name: "品牌运营部",
    organization: "品牌管理公司",
    parentDepartmentId: null,
    managerPersonId: "person-brand-ops-manager",
    isActive: true
  },
  {
    id: "dept-import-procurement",
    name: "进口采购部",
    organization: "进出口公司",
    parentDepartmentId: null,
    managerPersonId: "person-import-manager",
    isActive: true
  },
  {
    id: "dept-import-finance",
    name: "进出口财务部",
    organization: "进出口公司",
    parentDepartmentId: null,
    managerPersonId: "person-finance-director",
    isActive: true
  },
  {
    id: "dept-kzn-store",
    name: "喀山门店运营",
    organization: "喀山直营店主体",
    parentDepartmentId: null,
    managerPersonId: "person-kzn-store-manager",
    isActive: true
  },
  {
    id: "dept-spb-store",
    name: "圣彼得堡门店运营",
    organization: "圣彼得堡直营店主体",
    parentDepartmentId: null,
    managerPersonId: "person-spb-store-manager",
    isActive: true
  }
];

export const persons: PersonConfigRecord[] = [
  {
    id: "person-boss",
    displayName: "老板",
    organization: "品牌管理公司",
    departmentId: "dept-brand-ops",
    title: "集团负责人",
    managerPersonId: null,
    phone: "+7 900 000 1000",
    email: "boss@tea.local",
    isActive: true
  },
  {
    id: "person-finance-director",
    displayName: "赵洁",
    organization: "品牌管理公司",
    departmentId: "dept-brand-finance",
    title: "财务总监",
    managerPersonId: "person-boss",
    phone: "+7 900 000 1001",
    email: "finance.director@tea.local",
    isActive: true
  },
  {
    id: "person-cashier",
    displayName: "出纳",
    organization: "品牌管理公司",
    departmentId: "dept-brand-finance",
    title: "出纳",
    managerPersonId: "person-finance-director",
    phone: "+7 900 000 1002",
    email: "cashier@tea.local",
    isActive: true
  },
  {
    id: "person-brand-ops-manager",
    displayName: "Anna Petrova",
    organization: "品牌管理公司",
    departmentId: "dept-brand-ops",
    title: "品牌运营经理",
    managerPersonId: "person-boss",
    phone: "+7 900 000 1003",
    email: "brand.ops@tea.local",
    isActive: true
  },
  {
    id: "person-import-manager",
    displayName: "Anton Sidorov",
    organization: "进出口公司",
    departmentId: "dept-import-procurement",
    title: "进口业务负责人",
    managerPersonId: "person-boss",
    phone: "+7 900 000 1004",
    email: "import.manager@tea.local",
    isActive: true
  },
  {
    id: "person-kzn-store-manager",
    displayName: "喀山店长",
    organization: "喀山直营店主体",
    departmentId: "dept-kzn-store",
    title: "门店负责人",
    managerPersonId: "person-brand-ops-manager",
    phone: "+7 900 000 1005",
    email: "kazan.store@tea.local",
    isActive: true
  },
  {
    id: "person-spb-store-manager",
    displayName: "圣彼得堡店长",
    organization: "圣彼得堡直营店主体",
    departmentId: "dept-spb-store",
    title: "门店负责人",
    managerPersonId: "person-brand-ops-manager",
    phone: "+7 900 000 1006",
    email: "spb.store@tea.local",
    isActive: true
  },
  {
    id: "person-applicant",
    displayName: "王珊",
    organization: "喀山直营店主体",
    departmentId: "dept-kzn-store",
    title: "运营专员",
    managerPersonId: "person-kzn-store-manager",
    phone: "+7 900 000 1007",
    email: "applicant@tea.local",
    isActive: true
  }
];

export const projects: ProjectConfigRecord[] = [
  {
    id: "project-kzn-store-1",
    name: "喀山一店",
    organization: "喀山直营店主体",
    type: "store",
    code: "KZN-01",
    managerPersonId: "person-kzn-store-manager",
    isActive: true
  },
  {
    id: "project-spb-store-2",
    name: "圣彼得堡二店",
    organization: "圣彼得堡直营店主体",
    type: "store",
    code: "SPB-02",
    managerPersonId: "person-spb-store-manager",
    isActive: true
  },
  {
    id: "project-brand-campaign",
    name: "品牌投放项目",
    organization: "品牌管理公司",
    type: "project",
    code: "BRAND-2026",
    managerPersonId: "person-brand-ops-manager",
    isActive: true
  },
  {
    id: "project-import-shared",
    name: "进口公共采购",
    organization: "进出口公司",
    type: "shared",
    code: "IMP-SHARED",
    managerPersonId: "person-import-manager",
    isActive: true
  }
];

export const bankAccounts: BankAccountConfigRecord[] = [
  {
    id: "ba-001",
    organization: "品牌管理公司",
    accountName: "品牌管理公司 - RUB 主账户",
    bankName: "Sberbank",
    accountNumber: "40702810900010001001",
    currency: "RUB",
    balance: 4200000,
    isDefault: true,
    isActive: true
  },
  {
    id: "ba-002",
    organization: "进出口公司",
    accountName: "进出口公司 - RUB 结算账户",
    bankName: "VTB",
    accountNumber: "40702810900010002002",
    currency: "RUB",
    balance: 5180000,
    isDefault: true,
    isActive: true
  },
  {
    id: "ba-003",
    organization: "喀山直营店主体",
    accountName: "喀山直营店主体 - RUB 运营账户",
    bankName: "Alfa Bank",
    accountNumber: "40702810900010003003",
    currency: "RUB",
    balance: 1360000,
    isDefault: true,
    isActive: true
  },
  {
    id: "ba-004",
    organization: "圣彼得堡直营店主体",
    accountName: "圣彼得堡直营店主体 - RUB 运营账户",
    bankName: "T-Bank",
    accountNumber: "40702810900010004004",
    currency: "RUB",
    balance: 980000,
    isDefault: true,
    isActive: true
  }
];

export const exchangeRates: ExchangeRateConfigRecord[] = [
  {
    id: "fx-001",
    organizationScope: ["进出口公司"],
    fromCurrency: "CNY",
    toCurrency: "RUB",
    rate: 11.9,
    effectiveDate: "2026-06-01",
    isActive: true
  },
  {
    id: "fx-002",
    organizationScope: ["进出口公司"],
    fromCurrency: "USD",
    toCurrency: "RUB",
    rate: 92.4,
    effectiveDate: "2026-06-01",
    isActive: true
  }
];

export const ledgerAccountMappings: LedgerAccountMappingRecord[] = [
  {
    id: "lam-001",
    organizationScope: ["品牌管理公司", "喀山直营店主体", "圣彼得堡直营店主体", "加盟结算主体"],
    scenario: "standard_payment",
    accountCode: "6601",
    accountName: "付款申请支出",
    isActive: true
  },
  {
    id: "lam-002",
    organizationScope: ["进出口公司"],
    scenario: "import_foreign_payment",
    accountCode: "6401",
    accountName: "进口采购预付款",
    isActive: true
  },
  {
    id: "lam-003",
    organizationScope: ["品牌管理公司", "进出口公司", "喀山直营店主体", "圣彼得堡直营店主体", "加盟结算主体"],
    scenario: "internal_transfer",
    accountCode: "6801",
    accountName: "内部往来支出",
    isActive: true
  }
];

export const paymentParties: PaymentPartyConfigRecord[] = [
  {
    id: "pp-001",
    name: "喀山设备供应商A",
    type: "supplier",
    organizationScope: ["喀山直营店主体", "品牌管理公司"],
    bankName: "Sberbank",
    bankAccount: "40702810900010000001",
    contactName: "Anton",
    phone: "+7 900 000 0001",
    isActive: true
  },
  {
    id: "pp-002",
    name: "俄境物流代理B",
    type: "supplier",
    organizationScope: ["进出口公司"],
    bankName: "VTB",
    bankAccount: "40702810900010000002",
    contactName: "Irina",
    phone: "+7 900 000 0002",
    isActive: true
  },
  {
    id: "pp-003",
    name: "品牌管理公司",
    type: "internal",
    organizationScope: ["喀山直营店主体", "圣彼得堡直营店主体"],
    bankName: "Alfa Bank",
    bankAccount: "40702810900010000003",
    contactName: "集团财务",
    phone: "+7 900 000 0003",
    isActive: true
  },
  {
    id: "pp-004",
    name: "门店临时维修个人",
    type: "person",
    organizationScope: ["喀山直营店主体", "圣彼得堡直营店主体"],
    bankName: "T-Bank",
    bankAccount: "40817810000010000004",
    contactName: "Pavel",
    phone: "+7 900 000 0004",
    isActive: true
  }
];

export const ocrRules: OcrRuleConfigRecord[] = [
  {
    id: "ocr-rule-invoice",
    name: "发票识别规则",
    documentType: "invoice",
    organizationScope: ["品牌管理公司", "进出口公司", "喀山直营店主体", "圣彼得堡直营店主体"],
    requiredFields: ["amount", "companyName", "documentDate"],
    blockOnMismatch: true,
    enabled: true
  },
  {
    id: "ocr-rule-contract",
    name: "合同识别规则",
    documentType: "contract",
    organizationScope: ["品牌管理公司", "进出口公司", "喀山直营店主体", "圣彼得堡直营店主体"],
    requiredFields: ["companyName", "contractSubject", "documentDate"],
    blockOnMismatch: true,
    enabled: true
  },
  {
    id: "ocr-rule-voucher",
    name: "付款凭证识别规则",
    documentType: "voucher",
    organizationScope: ["品牌管理公司", "进出口公司", "喀山直营店主体", "圣彼得堡直营店主体"],
    requiredFields: ["amount", "bankAccount", "documentDate"],
    blockOnMismatch: false,
    enabled: true
  }
];

export const roleConfigs: RoleConfigRecord[] = [
  {
    id: "boss",
    label: "老板",
    description: "查看集团整体经营、审批关键单据、查看报表并配置系统核心规则。",
    pageAccess: [
      "dashboard",
      "business_center",
      "finance_center",
      "master_data_center",
      "rules_center",
      "system_center",
      "approvals",
      "ocr_workbench",
      "payment_requests",
      "purchase_requests",
      "contract_requests",
      "payment_execution",
      "ledger",
      "reports",
      "settings",
      "settings_organization",
      "settings_flows",
      "settings_forms",
      "settings_ocr_rules",
      "settings_bank_accounts",
      "settings_exchange_rates",
      "settings_ledger_mappings",
      "settings_payment_parties",
      "settings_access",
      "settings_master_data"
    ],
    dataScope: "all",
    configPermissions: {
      organizations: true,
      masterData: true,
      flows: true,
      forms: true,
      ocrRules: true,
      bankAccounts: true,
      exchangeRates: true,
      ledgerMappings: true,
      paymentParties: true,
      access: true
    },
    approvalPermissions: {
      approve: true,
      reject: true,
      returnToDraft: false,
      confirmOcr: false,
      executePayment: false,
      cancelOwnRequest: false
    }
  },
  {
    id: "finance",
    label: "财务",
    description: "处理审批、付款执行、总账、报表和部分主数据维护。",
    pageAccess: [
      "dashboard",
      "business_center",
      "finance_center",
      "master_data_center",
      "rules_center",
      "system_center",
      "approvals",
      "ocr_workbench",
      "payment_requests",
      "purchase_requests",
      "contract_requests",
      "payment_execution",
      "ledger",
      "reports",
      "settings",
      "settings_organization",
      "settings_bank_accounts",
      "settings_ocr_rules",
      "settings_exchange_rates",
      "settings_ledger_mappings",
      "settings_payment_parties",
      "settings_access",
      "settings_master_data"
    ],
    dataScope: "all",
    configPermissions: {
      organizations: true,
      masterData: true,
      flows: false,
      forms: false,
      ocrRules: true,
      bankAccounts: true,
      exchangeRates: true,
      ledgerMappings: true,
      paymentParties: true,
      access: true
    },
    approvalPermissions: {
      approve: true,
      reject: true,
      returnToDraft: false,
      confirmOcr: true,
      executePayment: true,
      cancelOwnRequest: false
    }
  },
  {
    id: "cashier",
    label: "出纳",
    description: "确认 OCR 异常、核对付款执行和相关单据。",
    pageAccess: ["dashboard", "business_center", "finance_center", "approvals", "ocr_workbench", "payment_requests", "purchase_requests", "contract_requests", "payment_execution"],
    dataScope: "organization",
    configPermissions: {
      organizations: false,
      masterData: false,
      flows: false,
      forms: false,
      ocrRules: false,
      bankAccounts: false,
      exchangeRates: false,
      ledgerMappings: false,
      paymentParties: false,
      access: false
    },
    approvalPermissions: {
      approve: false,
      reject: false,
      returnToDraft: false,
      confirmOcr: true,
      executePayment: true,
      cancelOwnRequest: false
    }
  },
  {
    id: "applicant",
    label: "申请人",
    description: "发起和查看本人相关申请，处理被驳回或退回修改的单据。",
    pageAccess: ["dashboard", "business_center", "payment_requests", "purchase_requests", "contract_requests"],
    dataScope: "own",
    configPermissions: {
      organizations: false,
      masterData: false,
      flows: false,
      forms: false,
      ocrRules: false,
      bankAccounts: false,
      exchangeRates: false,
      ledgerMappings: false,
      paymentParties: false,
      access: false
    },
    approvalPermissions: {
      approve: false,
      reject: false,
      returnToDraft: true,
      confirmOcr: false,
      executePayment: false,
      cancelOwnRequest: true
    }
  }
];

export const userAccounts: UserAccountRecord[] = [
  {
    id: "user-boss-001",
    username: "boss",
    password: "boss2026",
    displayName: "老板",
    role: "boss",
    organizationScope: organizations.filter((item) => item.isActive).map((item) => item.displayName),
    isActive: true
  },
  {
    id: "user-finance-001",
    username: "finance",
    password: "finance2026",
    displayName: "赵洁",
    role: "finance",
    organizationScope: organizations.filter((item) => item.isActive).map((item) => item.displayName),
    isActive: true
  },
  {
    id: "user-cashier-001",
    username: "cashier",
    password: "cashier2026",
    displayName: "出纳",
    role: "cashier",
    organizationScope: ["品牌管理公司", "进出口公司", "喀山直营店主体", "圣彼得堡直营店主体"],
    isActive: true
  },
  {
    id: "user-applicant-001",
    username: "applicant",
    password: "applicant2026",
    displayName: "王珊",
    role: "applicant",
    organizationScope: ["喀山直营店主体", "品牌管理公司"],
    isActive: true
  }
];

export const approvalFlowTemplates: ApprovalFlowTemplate[] = [
  {
    id: "flow-payment-standard",
    name: "直营/品牌标准付款审批流",
    requestType: "payment",
    enabled: true,
    organizationScope: ["品牌管理公司", "喀山直营店主体", "圣彼得堡直营店主体"],
    amountRule: "默认适用；后续预留按金额切换",
    currencyScope: ["RUB", "CNY", "USD"],
    nodes: [
      {
        id: "node-01",
        name: "业务负责人确认",
        approverType: "manager",
        approverValue: "发起人上级",
        ccList: ["财务共享"],
        order: 1,
        actionOnPass: "进入 OCR 核对"
      },
      {
        id: "node-02",
        name: "财务审核",
        approverType: "role",
        approverValue: "财务",
        ccList: ["出纳"],
        order: 2,
        actionOnPass: "进入老板审批"
      },
      {
        id: "node-03",
        name: "老板审批",
        approverType: "role",
        approverValue: "老板",
        ccList: [],
        order: 3,
        actionOnPass: "转财务执行"
      }
    ]
  },
  {
    id: "flow-payment-import",
    name: "进出口付款审批流",
    requestType: "payment",
    enabled: true,
    organizationScope: ["进出口公司"],
    amountRule: "适用于进出口公司，对跨币种付款保留额外复核",
    currencyScope: ["RUB", "CNY", "USD"],
    nodes: [
      {
        id: "node-21",
        name: "进口业务负责人确认",
        approverType: "role",
        approverValue: "进口业务负责人",
        ccList: ["财务共享"],
        order: 1,
        actionOnPass: "进入 OCR 核对"
      },
      {
        id: "node-22",
        name: "外汇与单证复核",
        approverType: "person",
        approverValue: "外汇专员",
        ccList: ["出纳"],
        order: 2,
        actionOnPass: "转财务审核"
      },
      {
        id: "node-23",
        name: "财务总监审批",
        approverType: "person",
        approverValue: "会计总监",
        ccList: ["老板"],
        order: 3,
        actionOnPass: "转财务执行"
      }
    ]
  },
  {
    id: "flow-payment-internal",
    name: "内部往来付款流",
    requestType: "payment",
    enabled: true,
    organizationScope: ["品牌管理公司", "喀山直营店主体", "圣彼得堡直营店主体"],
    amountRule: "内部往来时优先使用",
    currencyScope: ["RUB"],
    nodes: [
      {
        id: "node-11",
        name: "组织负责人确认",
        approverType: "role",
        approverValue: "组织负责人",
        ccList: ["财务共享"],
        order: 1,
        actionOnPass: "进入 OCR / 附件校验"
      },
      {
        id: "node-12",
        name: "财务总监复核",
        approverType: "person",
        approverValue: "会计总监",
        ccList: ["老板"],
        order: 2,
        actionOnPass: "转财务执行"
      }
    ]
  }
];

export const paymentRequestFormTemplate: FormTemplateConfig = {
  id: "form-payment-v1",
  name: "付款申请 V1 表单",
  requestType: "payment",
  enabled: true,
  sections: [
    { id: "basic", label: "基础信息", description: "申请人、组织、项目等基础主数据。" },
    { id: "party", label: "付款对象", description: "付款对象类型、名称、银行信息。" },
    { id: "finance", label: "金额与往来", description: "币种、金额、内部往来等字段。" },
    { id: "purpose", label: "用途说明", description: "付款事由会影响审批与总账摘要。" },
    { id: "attachments", label: "附件", description: "审批与 OCR 核对所需材料。" }
  ],
  fields: [
    {
      id: "field-title",
      name: "title",
      label: "单据标题",
      type: "text",
      required: true,
      placeholder: "例如：门店七月原材料货款",
      width: "half",
      section: "basic"
    },
    {
      id: "field-applicant",
      name: "applicantName",
      label: "申请人",
      type: "text",
      required: true,
      defaultValue: "当前登录用户",
      placeholder: "系统自动带出",
      width: "half",
      section: "basic"
    },
    {
      id: "field-organization",
      name: "organization",
      label: "所属组织",
      type: "select",
      required: true,
      width: "half",
      section: "basic"
    },
    {
      id: "field-project",
      name: "projectName",
      label: "所属项目 / 门店",
      type: "select",
      required: false,
      width: "half",
      section: "basic"
    },
    {
      id: "field-party-type",
      name: "paymentPartyType",
      label: "付款对象类型",
      type: "select",
      required: true,
      width: "half",
      section: "party",
      options: [
        { value: "supplier", label: "供应商" },
        { value: "customer", label: "客户" },
        { value: "internal", label: "内部组织" },
        { value: "person", label: "个人" }
      ]
    },
    {
      id: "field-party-name",
      name: "paymentPartyName",
      label: "付款对象名称",
      type: "select",
      required: true,
      placeholder: "从资料库选择付款对象",
      width: "half",
      section: "party"
    },
    {
      id: "field-party-bank",
      name: "paymentPartyBank",
      label: "付款对象开户行",
      type: "text",
      required: true,
      placeholder: "例如：Sberbank",
      width: "half",
      section: "party"
    },
    {
      id: "field-party-account",
      name: "paymentPartyAccount",
      label: "付款对象银行账号",
      type: "text",
      required: true,
      placeholder: "输入银行账号",
      width: "half",
      section: "party"
    },
    {
      id: "field-currency",
      name: "currency",
      label: "币种",
      type: "select",
      required: true,
      width: "half",
      section: "finance",
      options: [
        { value: "RUB", label: "RUB" },
        { value: "CNY", label: "CNY" },
        { value: "USD", label: "USD" }
      ]
    },
    {
      id: "field-amount",
      name: "amount",
      label: "申请金额",
      type: "number",
      required: true,
      placeholder: "输入金额",
      width: "half",
      section: "finance"
    },
    {
      id: "field-internal",
      name: "isInternal",
      label: "是否内部往来",
      type: "select",
      required: true,
      width: "half",
      section: "finance",
      options: [
        { value: "false", label: "否" },
        { value: "true", label: "是" }
      ]
    },
    {
      id: "field-internal-target",
      name: "internalTarget",
      label: "内部往来目标组织",
      type: "select",
      required: false,
      placeholder: "内部往来时必填",
      width: "half",
      section: "finance"
    },
    {
      id: "field-purpose",
      name: "purpose",
      label: "用途 / 付款事由",
      type: "textarea",
      required: true,
      placeholder: "描述付款用途，后续用于审批、OCR核对和总账摘要。",
      width: "full",
      section: "purpose"
    },
    {
      id: "field-invoice",
      name: "invoiceAttachment",
      label: "发票附件",
      type: "attachment",
      required: true,
      width: "half",
      note: "必传",
      section: "attachments"
    },
    {
      id: "field-contract",
      name: "contractAttachment",
      label: "合同附件",
      type: "attachment",
      required: false,
      width: "half",
      note: "按业务需要上传",
      section: "attachments"
    },
    {
      id: "field-voucher",
      name: "voucherAttachment",
      label: "付款凭证附件",
      type: "attachment",
      required: false,
      width: "half",
      note: "付款后补充",
      section: "attachments"
    },
    {
      id: "field-other",
      name: "otherAttachment",
      label: "其他附件",
      type: "attachment",
      required: false,
      width: "half",
      note: "报价、说明、截图等",
      section: "attachments"
    }
  ]
};

export const paymentRequests: PaymentRequestRecord[] = [
  {
    id: "PAY-2026-0001",
    title: "门店六月设备尾款",
    organization: "品牌管理公司",
    projectName: "喀山一店",
    applicantName: "王珊",
    requestedAt: "2026-06-10",
    purpose: "支付制冰机与封口机尾款",
    amount: 120000,
    paidAmount: 120000,
    currency: "RUB",
    status: "paid",
    paymentPartyName: "喀山设备供应商A",
    paymentPartyType: "supplier",
    paymentPartyBank: "Sberbank",
    paymentPartyAccount: "40702810900010000001",
    isInternal: false,
    internalTarget: null,
    flowTemplateId: "flow-payment-standard",
    flowTemplateName: "标准付款审批流",
    currentApprovalNode: null,
    currentHandler: null,
    ccUsers: ["财务共享", "出纳"],
    approvalHistory: [
      {
        id: "AH-0001",
        action: "提交申请",
        node: "业务负责人确认",
        actor: "王珊",
        result: "已提交",
        note: "付款申请已发起",
        actedAt: "2026-06-10 09:10"
      },
      {
        id: "AH-0002",
        action: "OCR核对",
        node: "OCR 核对",
        actor: "系统",
        result: "识别一致",
        note: "发票和合同关键字段一致",
        actedAt: "2026-06-10 09:13"
      },
      {
        id: "AH-0003",
        action: "审批完成",
        node: "老板审批",
        actor: "老板",
        result: "通过",
        note: "同意付款",
        actedAt: "2026-06-10 11:20"
      },
      {
        id: "AH-0004",
        action: "财务执行",
        node: null,
        actor: "赵洁",
        result: "已付款",
        note: "一次性全额支付",
        actedAt: "2026-06-10 14:30"
      },
      {
        id: "AH-0005",
        action: "系统自动入账",
        node: null,
        actor: "系统",
        result: "已入账",
        note: "审批通过后系统已按组织科目自动入账",
        actedAt: "2026-06-10 11:21"
      }
    ],
    ocrStatus: "matched",
    ocrResult: {
      documentType: "invoice",
      matchedFields: ["amount", "companyName", "documentDate", "contractSubject"],
      mismatchedFields: [],
      extracted: {
        amount: "125000",
        companyName: "喀山设备供应商A",
        bankAccount: "40702810900010000001",
        documentDate: "2026-06-10",
        contractSubject: "门店冰箱设备采购"
      },
      note: "发票、合同和申请信息一致"
    },
    attachments: {
      invoice: ["invoice-june-a.pdf"],
      contract: ["contract-equipment-a.pdf"],
      voucher: ["voucher-0610-a.pdf"],
      other: []
    }
  },
  {
    id: "PAY-2026-0002",
    title: "原材料进口运费预付款",
    organization: "进出口公司",
    projectName: null,
    applicantName: "李铭",
    requestedAt: "2026-06-11",
    purpose: "支付六月海运及清关预付款",
    amount: 680000,
    paidAmount: 300000,
    currency: "RUB",
    status: "partially_paid",
    paymentPartyName: "俄境物流代理B",
    paymentPartyType: "supplier",
    paymentPartyBank: "VTB",
    paymentPartyAccount: "40702810900010000002",
    isInternal: false,
    internalTarget: null,
    flowTemplateId: "flow-payment-standard",
    flowTemplateName: "标准付款审批流",
    currentApprovalNode: null,
    currentHandler: "财务",
    ccUsers: ["出纳"],
    approvalHistory: [
      {
        id: "AH-0011",
        action: "提交申请",
        node: "业务负责人确认",
        actor: "李铭",
        result: "已提交",
        note: "运费预付款发起",
        actedAt: "2026-06-11 10:20"
      },
      {
        id: "AH-0012",
        action: "OCR核对",
        node: "OCR 核对",
        actor: "系统",
        result: "识别一致",
        note: "运费合同与金额一致",
        actedAt: "2026-06-11 10:23"
      },
      {
        id: "AH-0013",
        action: "审批完成",
        node: "老板审批",
        actor: "老板",
        result: "通过",
        note: "允许先付第一笔预付款",
        actedAt: "2026-06-11 12:10"
      },
      {
        id: "AH-0014",
        action: "财务执行",
        node: null,
        actor: "赵洁",
        result: "部分付款",
        note: "第一笔预付款 300000 RUB",
        actedAt: "2026-06-11 16:40"
      }
    ],
    ocrStatus: "matched",
    ocrResult: {
      documentType: "contract",
      matchedFields: ["amount", "companyName", "documentDate", "contractSubject"],
      mismatchedFields: [],
      extracted: {
        amount: "680000",
        companyName: "俄境物流代理B",
        bankAccount: "40702810900010000002",
        documentDate: "2026-06-11",
        contractSubject: "六月海运及清关预付款"
      },
      note: "合同和运费预付款信息一致"
    },
    attachments: {
      invoice: ["freight-invoice-b.pdf"],
      contract: ["freight-contract-b.pdf"],
      voucher: ["voucher-0611-b.pdf"],
      other: ["shipping-note-b.pdf"]
    }
  },
  {
    id: "PAY-2026-0003",
    title: "门店装修内部往来",
    organization: "直营门店主体",
    projectName: "圣彼得堡二店",
    applicantName: "周扬",
    requestedAt: "2026-06-12",
    purpose: "门店装修款内部往来拨付",
    amount: 250000,
    paidAmount: 0,
    currency: "RUB",
    status: "ocr_exception_pending_confirm",
    paymentPartyName: "品牌管理公司",
    paymentPartyType: "internal",
    paymentPartyBank: "Alfa Bank",
    paymentPartyAccount: "40702810900010000003",
    isInternal: true,
    internalTarget: "品牌管理公司",
    flowTemplateId: "flow-payment-internal",
    flowTemplateName: "内部往来付款流",
    currentApprovalNode: "组织负责人确认",
    currentHandler: "组织负责人",
    ccUsers: ["财务共享"],
    approvalHistory: [
      {
        id: "AH-0021",
        action: "提交申请",
        node: "组织负责人确认",
        actor: "周扬",
        result: "已提交",
        note: "内部往来付款发起",
        actedAt: "2026-06-12 09:35"
      },
      {
        id: "AH-0022",
        action: "OCR核对",
        node: "OCR 核对",
        actor: "系统",
        result: "异常待确认",
        note: "附件信息和表单金额不一致",
        actedAt: "2026-06-12 09:38"
      }
    ],
    ocrStatus: "exception_pending_confirm",
    ocrResult: {
      documentType: "contract",
      matchedFields: ["companyName", "documentDate", "contractSubject"],
      mismatchedFields: ["amount"],
      extracted: {
        amount: "230000",
        companyName: "品牌管理公司",
        bankAccount: "40702810900010000003",
        documentDate: "2026-06-12",
        contractSubject: "门店装修内部往来拨付"
      },
      note: "附件金额与申请金额不一致，需要出纳确认"
    },
    attachments: {
      invoice: [],
      contract: ["store-fitout-transfer.pdf"],
      voucher: [],
      other: ["ocr-check-note.png"]
    }
  }
];

export const paymentExecutions: PaymentExecutionRecord[] = [
  {
    id: "PE-001",
    paymentRequestId: "PAY-2026-0001",
    bankAccountName: "品牌管理公司 - RUB 主账户",
    amount: 120000,
    currency: "RUB",
    executedAt: "2026-06-10",
    bankReference: "PAYREF-20260610-001",
    voucherFiles: ["voucher-brand-rent-20260610.pdf"],
    note: "一次性全额支付",
    executorName: "赵洁",
    verificationStatus: "verified",
    verificationNote: "付款回单、申请金额和账户信息一致。",
    verifiedBy: "赵洁",
    verifiedAt: "2026-06-10T15:30:00.000Z"
  },
  {
    id: "PE-002",
    paymentRequestId: "PAY-2026-0002",
    bankAccountName: "进出口公司 - RUB 结算账户",
    amount: 300000,
    currency: "RUB",
    executedAt: "2026-06-11",
    bankReference: "PAYREF-20260611-002",
    voucherFiles: ["voucher-import-prepay-20260611.pdf"],
    note: "第一笔预付款",
    executorName: "赵洁",
    verificationStatus: "pending",
    verificationNote: "",
    verifiedBy: null,
    verifiedAt: null
  }
];

export const purchaseRequests: PurchaseRequestRecord[] = [
  {
    id: "PUR-2026-0001",
    title: "门店冰箱设备采购",
    organization: "品牌管理公司",
    projectName: "喀山阿尔巴特店",
    applicantName: "王珊",
    requestedAt: "2026-06-09",
    supplierName: "Мороз Тех",
    purchaseType: "设备采购",
    content: "双门冷藏冰箱",
    specification: "1200L / 商用",
    quantity: 2,
    unit: "台",
    unitPrice: 45000,
    currency: "RUB",
    amount: 90000,
    purpose: "新店设备补充采购",
    expectedArrivalDate: "2026-06-20",
    requiresPayment: true,
    requiresInventory: true,
    linkedContractName: "冰箱设备年度采购合同",
    status: "approved",
    currentApprovalNode: null,
    currentHandler: "采购台账",
    approvalHistory: [
      { id: "PH-PUR-001", action: "审批通过", node: "财务总监审批", actor: "赵洁", result: "通过", note: "同意形成采购台账。", actedAt: "2026-06-10T11:30:00.000Z" },
      { id: "PH-PUR-002", action: "提交申请", node: "部门负责人审批", actor: "王珊", result: "已提交", note: "门店设备采购。", actedAt: "2026-06-09T10:10:00.000Z" }
    ],
    attachments: ["purchase-quote-fridge.pdf", "purchase-spec-fridge.pdf"]
  },
  {
    id: "PUR-2026-0002",
    title: "六月进口原料采购",
    organization: "进出口公司",
    projectName: "进口公共采购",
    applicantName: "王珊",
    requestedAt: "2026-06-11",
    supplierName: "Guangzhou Tea Supply",
    purchaseType: "原料采购",
    content: "奶茶原料与包装",
    specification: "六月批次进口",
    quantity: 1,
    unit: "批",
    unitPrice: 320000,
    currency: "RUB",
    amount: 320000,
    purpose: "六月进口原料备货",
    expectedArrivalDate: "2026-06-28",
    requiresPayment: true,
    requiresInventory: true,
    linkedContractName: "六月进口供货合同",
    status: "processing",
    currentApprovalNode: "外汇与单证复核",
    currentHandler: "进口业务负责人",
    approvalHistory: [
      { id: "PH-PUR-003", action: "提交申请", node: "进口业务负责人确认", actor: "王珊", result: "已提交", note: "进口原料采购申请。", actedAt: "2026-06-11T09:20:00.000Z" }
    ],
    attachments: ["purchase-import-june.pdf"]
  }
];

export const purchaseLedgers: PurchaseLedgerRecord[] = [
  {
    id: "PL-001",
    purchaseRequestId: "PUR-2026-0001",
    organization: "品牌管理公司",
    supplierName: "Мороз Тех",
    purchaseType: "设备采购",
    amount: 90000,
    currency: "RUB",
    createdAt: "2026-06-10",
    status: "linked_payment",
    note: "审批通过后已形成采购台账。"
  }
];

export const contractApprovals: ContractApprovalRecord[] = [
  {
    id: "CON-2026-0001",
    title: "冰箱设备年度采购合同",
    organization: "品牌管理公司",
    projectName: "喀山阿尔巴特店",
    applicantName: "王珊",
    requestedAt: "2026-06-08",
    contractName: "冰箱设备年度采购合同",
    contractNo: "CTR-BRAND-2026-001",
    contractType: "采购合同",
    counterpartyName: "Мороз Тех",
    currency: "RUB",
    amount: 180000,
    signedAt: "2026-06-08",
    effectiveDate: "2026-06-09",
    expiryDate: "2026-12-31",
    paymentTerms: "签订后 50%，到货后 50%",
    settlementMethod: "银行转账",
    summary: "门店设备年度采购框架合同。",
    status: "approved",
    currentApprovalNode: null,
    currentHandler: "合同台账",
    ocrStatus: "matched",
    approvalHistory: [
      { id: "CH-001", action: "审批通过", node: "老板审批", actor: "老板", result: "通过", note: "同意签约并进入合同台账。", actedAt: "2026-06-09T14:20:00.000Z" },
      { id: "CH-002", action: "OCR核对", node: "OCR 核对", actor: "系统", result: "识别一致", note: "合同主体与金额一致。", actedAt: "2026-06-08T18:00:00.000Z" }
    ],
    attachments: ["contract-fridge-annual.pdf"]
  },
  {
    id: "CON-2026-0002",
    title: "六月进口供货合同",
    organization: "进出口公司",
    projectName: "进口公共采购",
    applicantName: "王珊",
    requestedAt: "2026-06-10",
    contractName: "六月进口供货合同",
    contractNo: "CTR-IMP-2026-006",
    contractType: "进口供货合同",
    counterpartyName: "Guangzhou Tea Supply",
    currency: "USD",
    amount: 25000,
    signedAt: "2026-06-10",
    effectiveDate: "2026-06-11",
    expiryDate: "2026-08-31",
    paymentTerms: "预付 60%，到港后结清",
    settlementMethod: "美元电汇",
    summary: "六月批次原料与包装进口供货合同。",
    status: "processing",
    currentApprovalNode: "财务总监审批",
    currentHandler: "财务总监",
    ocrStatus: "matched",
    approvalHistory: [
      { id: "CH-003", action: "提交申请", node: "进口业务负责人确认", actor: "王珊", result: "已提交", note: "进口供货合同审批。", actedAt: "2026-06-10T13:10:00.000Z" }
    ],
    attachments: ["contract-import-june.pdf"]
  }
];

export const contractLedgers: ContractLedgerRecord[] = [
  {
    id: "CL-001",
    contractRequestId: "CON-2026-0001",
    organization: "品牌管理公司",
    contractName: "冰箱设备年度采购合同",
    contractNo: "CTR-BRAND-2026-001",
    counterpartyName: "Мороз Тех",
    amount: 180000,
    currency: "RUB",
    effectiveDate: "2026-06-09",
    expiryDate: "2026-12-31",
    status: "active",
    note: "审批通过后已生成合同台账。"
  }
];

export const ledgerEntries: LedgerEntryRecord[] = [
  {
    id: "LE-001",
    paymentRequestId: "PAY-2026-0001",
    sourceType: "payment_request",
    sourceNo: "PAY-2026-0001",
    organization: "品牌管理公司",
    projectName: "喀山一店",
    businessDate: "2026-06-10",
    currency: "RUB",
    originalAmount: 120000,
    exchangeRate: 1,
    functionalAmount: 120000,
    direction: "outflow",
    accountCode: "6601",
    accountName: "设备采购支出",
    summary: "制冰机与封口机尾款已入账"
  },
  {
    id: "LE-002",
    paymentRequestId: "PAY-2026-0002",
    sourceType: "payment_request",
    sourceNo: "PAY-2026-0002",
    organization: "进出口公司",
    projectName: null,
    businessDate: "2026-06-11",
    currency: "RUB",
    originalAmount: 300000,
    exchangeRate: 1,
    functionalAmount: 300000,
    direction: "outflow",
    accountCode: "6403",
    accountName: "物流及清关预付款",
    summary: "运费预付款第一笔"
  }
];

export function getDashboardMetrics() {
  const totalFunds = 12850000;
  const pendingApprovals = paymentRequests.filter((request) =>
    ["submitted", "processing", "ocr_pending", "ocr_exception_pending_confirm", "approved_waiting_payment", "partially_paid"].includes(request.status)
  ).length;
  const ocrExceptions = paymentRequests.filter((request) => request.ocrStatus === "exception_pending_confirm").length;
  const weekOutflow = ledgerEntries
    .filter((entry) => entry.direction === "outflow")
    .reduce((sum, entry) => sum + entry.functionalAmount, 0);

  return {
    totalFunds,
    pendingApprovals,
    ocrExceptions,
    weekOutflow
  };
}

export function getOrganizationMetrics(records: OrganizationConfigRecord[] = organizations) {
  const activeOrganizations = records.filter((item) => item.isActive).length;
  const groupReportingOrganizations = records.filter((item) => item.includeInGroupReport).length;
  const vatOrganizations = records.filter((item) => item.taxMode === "VAT").length;
  const usnOrganizations = records.filter((item) => item.taxMode === "USN").length;

  return {
    totalOrganizations: records.length,
    activeOrganizations,
    groupReportingOrganizations,
    vatOrganizations,
    usnOrganizations
  };
}

export function getFlowTemplateMetrics(records: ApprovalFlowTemplate[] = approvalFlowTemplates) {
  return {
    totalTemplates: records.length,
    activeTemplates: records.filter((item) => item.enabled).length,
    paymentTemplates: records.filter((item) => item.requestType === "payment").length,
    coveredOrganizations: new Set(records.flatMap((item) => item.organizationScope)).size
  };
}

export function getPaymentFormTemplateMetrics(template: FormTemplateConfig = paymentRequestFormTemplate) {
  return {
    totalFields: template.fields.filter((field) => field.enabled !== false).length,
    requiredFields: template.fields.filter((field) => field.enabled !== false && field.required).length,
    attachmentFields: template.fields.filter((field) => field.enabled !== false && field.type === "attachment").length,
    sectionCount: template.sections.length
  };
}

export function getBankAccountMetrics(accounts: BankAccountConfigRecord[] = bankAccounts) {
  return {
    totalAccounts: accounts.length,
    activeAccounts: accounts.filter((item) => item.isActive).length,
    rubAccounts: accounts.filter((item) => item.currency === "RUB").length,
    defaultAccounts: accounts.filter((item) => item.isDefault).length
  };
}

export function getPaymentPartyMetrics(parties: PaymentPartyConfigRecord[] = paymentParties) {
  return {
    totalParties: parties.length,
    activeParties: parties.filter((item) => item.isActive).length,
    internalParties: parties.filter((item) => item.type === "internal").length,
    supplierParties: parties.filter((item) => item.type === "supplier").length
  };
}

export function getPaymentWorkflowSummary() {
  return {
    total: paymentRequests.length,
    awaitingApproval: paymentRequests.filter((item) =>
      ["submitted", "ocr_pending", "ocr_exception_pending_confirm", "processing"].includes(item.status)
    ).length,
    awaitingPayment: paymentRequests.filter((item) => item.status === "approved_waiting_payment").length,
    partiallyPaid: paymentRequests.filter((item) => item.status === "partially_paid").length,
    posted: paymentRequests.filter((item) => item.status === "paid").length
  };
}

export function getStatusTone(status: PaymentRequestStatus) {
  if (status === "paid") {
    return "bg-emerald-50 text-emerald-700";
  }
  if (["ocr_exception_pending_confirm", "rejected", "cancelled"].includes(status)) {
    return "bg-rose-50 text-rose-700";
  }
  if (["approved_waiting_payment", "partially_paid"].includes(status)) {
    return "bg-amber-50 text-amber-700";
  }
  return "bg-slate-100 text-slate-700";
}

export function getPaymentRequestById(requestId: string) {
  return paymentRequests.find((request) => request.id === requestId) ?? null;
}

export function getExecutionsByRequestId(requestId: string) {
  return paymentExecutions.filter((execution) => execution.paymentRequestId === requestId);
}

export function getLedgerEntriesByRequestId(requestId: string) {
  return ledgerEntries.filter((entry) => entry.paymentRequestId === requestId);
}

export function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency,
    maximumFractionDigits: 2
  }).format(amount);
}
