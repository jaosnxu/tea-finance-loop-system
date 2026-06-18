import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { getPersistenceModeLabel, isDatabasePersistenceEnabled } from "@/lib/persistence";
import { readDatabaseConfigCache, readDatabaseConfigState, readDatabaseState, writeDatabaseConfigState, writeDatabaseState } from "@/lib/persistence-db";

import {
  approvalFlowTemplates,
  bankAccounts,
  contractApprovals as seedContractApprovals,
  contractLedgers as seedContractLedgers,
  departments,
  ocrRules,
  exchangeRates,
  formatMoney,
  getStatusTone,
  getBankAccountMetrics,
  getFlowTemplateMetrics,
  getOrganizationMetrics,
  getPaymentFormTemplateMetrics,
  getPaymentPartyMetrics,
  ledgerAccountMappings,
  ledgerEntries as seedLedgerEntries,
  organizations,
  ocrStatusLabels,
  paymentRequestFormTemplate,
  persons,
  projects,
  roleConfigs,
  paymentExecutions as seedExecutions,
  userAccounts,
  paymentParties,
  paymentRequests as seedPaymentRequests,
  purchaseLedgers as seedPurchaseLedgers,
  purchaseRequests as seedPurchaseRequests,
  paymentStatusLabels
} from "@/lib/mock-data";
import type {
  ContractApprovalRecord,
  ContractLedgerRecord,
  LedgerEntryRecord,
  PaymentExecutionRecord,
  PaymentRequestRecord,
  PurchaseLedgerRecord,
  PurchaseRequestRecord
} from "@/lib/mock-data";
import type {
  DepartmentConfigRecord,
  ExchangeRateConfigRecord,
  LedgerAccountMappingRecord,
  OcrRuleConfigRecord,
  OrganizationConfigRecord,
  PersonConfigRecord,
  ProjectConfigRecord,
  RoleConfigRecord,
  UserAccountRecord
} from "@/lib/types";

type RuntimeState = {
  paymentRequests: PaymentRequestRecord[];
  paymentExecutions: PaymentExecutionRecord[];
  ledgerEntries: LedgerEntryRecord[];
  purchaseRequests: PurchaseRequestRecord[];
  purchaseLedgers: PurchaseLedgerRecord[];
  contractApprovals: ContractApprovalRecord[];
  contractLedgers: ContractLedgerRecord[];
};

type ConfigRuntimeState = {
  organizations: typeof organizations;
  departments: typeof departments;
  persons: typeof persons;
  projects: typeof projects;
  ocrRules: typeof ocrRules;
  approvalFlowTemplates: typeof approvalFlowTemplates;
  paymentRequestFormTemplate: typeof paymentRequestFormTemplate;
  bankAccounts: typeof bankAccounts;
  exchangeRates: typeof exchangeRates;
  ledgerAccountMappings: typeof ledgerAccountMappings;
  paymentParties: typeof paymentParties;
  roleConfigs: typeof roleConfigs;
  userAccounts: typeof userAccounts;
};

function hasAutoLedgerEntry(
  state: RuntimeState,
  requestId: string
) {
  return state.ledgerEntries.some(
    (entry) => entry.paymentRequestId === requestId && entry.sourceType === "payment_request_approval"
  );
}

function isAutoPostedRequest(
  state: RuntimeState,
  request: PaymentRequestRecord
) {
  return hasAutoLedgerEntry(state, request.id);
}

function getOcrCandidateDocumentType(request: PaymentRequestRecord) {
  if (request.attachments.invoice.length > 0) {
    return "invoice" as const;
  }
  if (request.attachments.contract.length > 0) {
    return "contract" as const;
  }
  return "voucher" as const;
}

function buildOcrExtracted(request: PaymentRequestRecord) {
  const mismatchedAmount = request.status === "ocr_exception_pending_confirm" || request.ocrStatus === "exception_pending_confirm";
  return {
    amount: String(mismatchedAmount ? Math.max(request.amount - 20000, 0) : request.amount),
    companyName: request.paymentPartyName,
    bankAccount: request.paymentPartyAccount,
    documentDate: request.requestedAt,
    contractSubject: request.purpose
  };
}

function createOcrResult(
  request: PaymentRequestRecord,
  mode: "matched" | "exception"
): NonNullable<PaymentRequestRecord["ocrResult"]> {
  const allFields: Array<"amount" | "companyName" | "bankAccount" | "documentDate" | "contractSubject"> = [
    "amount",
    "companyName",
    "bankAccount",
    "documentDate",
    "contractSubject"
  ];
  const mismatchedFields: Array<"amount" | "companyName" | "bankAccount" | "documentDate" | "contractSubject"> =
    mode === "exception" ? ["amount"] : [];
  const matchedFields = allFields.filter((field) => !mismatchedFields.includes(field));
  return {
    documentType: getOcrCandidateDocumentType(request),
    matchedFields: [...matchedFields],
    mismatchedFields: [...mismatchedFields],
    extracted: buildOcrExtracted(request),
    note: mode === "exception" ? "关键字段存在差异，需要人工确认" : "关键字段识别一致"
  };
}

function normalizeRuntimeState(state: RuntimeState): RuntimeState {
  return {
    ...state,
    purchaseRequests: state.purchaseRequests ?? [],
    purchaseLedgers: state.purchaseLedgers ?? [],
    contractApprovals: state.contractApprovals ?? [],
    contractLedgers: state.contractLedgers ?? [],
    paymentRequests: state.paymentRequests.map((request) =>
      (request.status as string) === "ledger_posted"
        ? {
            ...request,
            status: "paid",
            currentHandler: request.currentHandler ?? "财务核对",
          }
        : request
    ),
  };
}

const runtimeDir = path.join(process.cwd(), "data", "runtime");
const runtimePath = path.join(runtimeDir, "payment-runtime.json");
const configRuntimePath = path.join(runtimeDir, "config-runtime.json");

const initialState: RuntimeState = {
  paymentRequests: seedPaymentRequests,
  paymentExecutions: seedExecutions,
  ledgerEntries: seedLedgerEntries,
  purchaseRequests: seedPurchaseRequests,
  purchaseLedgers: seedPurchaseLedgers,
  contractApprovals: seedContractApprovals,
  contractLedgers: seedContractLedgers
};

const initialConfigState: ConfigRuntimeState = {
  organizations,
  departments,
  persons,
  projects,
  ocrRules,
  approvalFlowTemplates,
  paymentRequestFormTemplate,
  bankAccounts,
  exchangeRates,
  ledgerAccountMappings,
  paymentParties,
  roleConfigs,
  userAccounts
};

export function getPersistenceSnapshot() {
  return {
    mode: isDatabasePersistenceEnabled() ? "database" : "runtime_json",
    label: getPersistenceModeLabel(),
    writableTarget: isDatabasePersistenceEnabled() ? "PostgreSQL / Prisma" : "data/runtime/*.json",
  } as const;
}

async function ensureRuntimeFile() {
  await mkdir(runtimeDir, { recursive: true });
  try {
    await readFile(runtimePath, "utf-8");
  } catch {
    await writeFile(runtimePath, JSON.stringify(initialState, null, 2), "utf-8");
  }
}

export async function readRuntimeState(): Promise<RuntimeState> {
  if (isDatabasePersistenceEnabled()) {
    return readDatabaseState();
  }
  await ensureRuntimeFile();
  const raw = await readFile(runtimePath, "utf-8");
  return normalizeRuntimeState(JSON.parse(raw) as RuntimeState);
}

export async function writeRuntimeState(state: RuntimeState) {
  if (isDatabasePersistenceEnabled()) {
    await writeDatabaseState(normalizeRuntimeState(state));
    return;
  }
  await ensureRuntimeFile();
  await writeFile(runtimePath, JSON.stringify(normalizeRuntimeState(state), null, 2), "utf-8");
}

function ensureConfigRuntimeFile() {
  mkdirSync(runtimeDir, { recursive: true });
  if (!existsSync(configRuntimePath)) {
    writeFileSync(configRuntimePath, JSON.stringify(initialConfigState, null, 2), "utf-8");
  }
}

function readConfigRuntimeState(): ConfigRuntimeState {
  if (isDatabasePersistenceEnabled()) {
    return readDatabaseConfigCache() ?? initialConfigState;
  }
  ensureConfigRuntimeFile();
  const raw = JSON.parse(readFileSync(configRuntimePath, "utf-8")) as Partial<ConfigRuntimeState>;
  return {
    organizations: raw.organizations ?? initialConfigState.organizations,
    departments: raw.departments ?? initialConfigState.departments,
    persons: raw.persons ?? initialConfigState.persons,
    projects: raw.projects ?? initialConfigState.projects,
    ocrRules: raw.ocrRules ?? initialConfigState.ocrRules,
    approvalFlowTemplates: raw.approvalFlowTemplates ?? initialConfigState.approvalFlowTemplates,
    paymentRequestFormTemplate: raw.paymentRequestFormTemplate ?? initialConfigState.paymentRequestFormTemplate,
    bankAccounts: raw.bankAccounts ?? initialConfigState.bankAccounts,
    exchangeRates: raw.exchangeRates ?? initialConfigState.exchangeRates,
    ledgerAccountMappings: raw.ledgerAccountMappings ?? initialConfigState.ledgerAccountMappings,
    paymentParties: raw.paymentParties ?? initialConfigState.paymentParties,
    roleConfigs: raw.roleConfigs ?? initialConfigState.roleConfigs,
    userAccounts: raw.userAccounts ?? initialConfigState.userAccounts
  };
}

async function readConfigState(): Promise<ConfigRuntimeState> {
  if (!isDatabasePersistenceEnabled()) {
    return readConfigRuntimeState();
  }
  return (await readDatabaseConfigState()) ?? readDatabaseConfigCache() ?? initialConfigState;
}

async function writeConfigRuntimeState(state: ConfigRuntimeState) {
  if (isDatabasePersistenceEnabled()) {
    await writeDatabaseConfigState(state);
    return;
  }
  ensureConfigRuntimeFile();
  writeFileSync(configRuntimePath, JSON.stringify(state, null, 2), "utf-8");
}

function withOrganizationDerivedCounts(
  organizationRows: OrganizationConfigRecord[],
  departmentRows: DepartmentConfigRecord[],
  projectRows: ProjectConfigRecord[]
) {
  return organizationRows.map((organization) => ({
    ...organization,
    projectCount: projectRows.filter((item) => item.organization === organization.displayName && item.isActive).length,
    departmentCount: departmentRows.filter((item) => item.organization === organization.displayName && item.isActive).length
  }));
}

export async function getPaymentRequests() {
  const state = await readRuntimeState();
  return state.paymentRequests;
}

export async function getPurchaseRequests() {
  const state = await readRuntimeState();
  return state.purchaseRequests;
}

export async function getPurchaseRequestById(requestId: string) {
  const state = await readRuntimeState();
  return state.purchaseRequests.find((item) => item.id === requestId) ?? null;
}

export async function getPurchaseLedgers() {
  const state = await readRuntimeState();
  return state.purchaseLedgers;
}

export async function getContractApprovals() {
  const state = await readRuntimeState();
  return state.contractApprovals;
}

export async function getContractApprovalById(requestId: string) {
  const state = await readRuntimeState();
  return state.contractApprovals.find((item) => item.id === requestId) ?? null;
}

export async function getContractLedgers() {
  const state = await readRuntimeState();
  return state.contractLedgers;
}

export type PaymentRoleFilter = "boss" | "finance" | "cashier" | "applicant";
export type ApprovalCenterTab = "inbox" | "submitted" | "processed" | "cc" | "exceptions";

export type PaymentListFilters = {
  role?: PaymentRoleFilter;
  status?: PaymentRequestRecord["status"] | "all";
};

export async function getFilteredPaymentRequests(filters: PaymentListFilters = {}) {
  const all = await getPaymentRequests();
  return all.filter((request) => {
    if (filters.role && !matchesRoleFilter(request, filters.role)) {
      return false;
    }
    if (filters.status && filters.status !== "all" && request.status !== filters.status) {
      return false;
    }
    return true;
  });
}

function roleKeywordMap(role: PaymentRoleFilter) {
  if (role === "boss") {
    return ["老板"];
  }
  if (role === "finance") {
    return ["财务", "财务总监", "财务共享", "赵洁"];
  }
  if (role === "cashier") {
    return ["出纳"];
  }
  return ["王珊"];
}

function roleUserName(role: PaymentRoleFilter) {
  return role === "applicant" ? "王珊" : role === "finance" ? "赵洁" : role === "cashier" ? "出纳" : "老板";
}

function getApprovalPriority(request: PaymentRequestRecord) {
  if (request.status === "ocr_exception_pending_confirm" || request.status === "rejected") {
    return "异常";
  }
  if (request.amount >= 100000) {
    return "高金额";
  }
  if (request.status === "approved_waiting_payment") {
    return "待付款";
  }
  return "普通";
}

function isOverdueRequest(request: PaymentRequestRecord, state?: RuntimeState) {
  if (request.status === "cancelled") {
    return false;
  }
  if (request.status === "paid" && state && isAutoPostedRequest(state, request)) {
    return false;
  }
  const requestedAt = new Date(request.requestedAt);
  const now = new Date();
  return now.getTime() - requestedAt.getTime() > 3 * 24 * 60 * 60 * 1000;
}

function matchesApprovalTab(request: PaymentRequestRecord, role: PaymentRoleFilter, tab: ApprovalCenterTab) {
  const keywords = roleKeywordMap(role);
  const currentHandler = request.currentHandler ?? "";
  const applicant = roleUserName(role);
  const actedByRole = request.approvalHistory.some((item) => keywords.some((keyword) => item.actor.includes(keyword)));
  const ccMatched =
    request.ccUsers.some((user) => keywords.some((keyword) => user.includes(keyword))) ||
    request.approvalHistory.some((item) => item.action === "提交申请" && item.result.includes("已提交") && request.ccUsers.length > 0);
  const waitingForRole =
    keywords.some((keyword) => currentHandler.includes(keyword)) ||
    (role === "finance" && ["approved_waiting_payment", "partially_paid", "paid"].includes(request.status)) ||
    (role === "cashier" && ["ocr_pending", "ocr_exception_pending_confirm"].includes(request.status)) ||
    (role === "boss" && request.amount >= 100000 && request.status === "processing");

  if (tab === "inbox") {
    return waitingForRole;
  }
  if (tab === "submitted") {
    return request.applicantName === applicant;
  }
  if (tab === "processed") {
    return actedByRole;
  }
  if (tab === "cc") {
    return ccMatched;
  }
  return request.ocrStatus === "exception_pending_confirm" || request.status === "ocr_exception_pending_confirm" || request.status === "rejected";
}

export async function getApprovalCenterRows(filters: {
  role: PaymentRoleFilter;
  tab: ApprovalCenterTab;
  status?: PaymentRequestRecord["status"] | "all";
  organization?: string;
}) {
  const state = await readRuntimeState();
  const requests = state.paymentRequests;
  return requests
    .filter((request) => matchesApprovalTab(request, filters.role, filters.tab))
    .filter((request) => !filters.status || filters.status === "all" || request.status === filters.status)
    .filter((request) => !filters.organization || filters.organization === "all" || request.organization === filters.organization)
    .map((request) => ({
      ...request,
      workflowNodeSummary: request.approvalHistory
        .slice()
        .reverse()
        .map((item) => `${item.action}${item.node ? `·${item.node}` : ""}`)
        .slice(-4)
        .join(" -> "),
      currentStepLabel:
        request.status === "ocr_pending" || request.status === "ocr_exception_pending_confirm"
          ? "OCR核对"
          : request.status === "processing"
            ? "审批处理"
            : request.status === "approved_waiting_payment" || request.status === "partially_paid"
              ? "财务执行"
              : request.status === "paid"
                ? isAutoPostedRequest(state, request)
                  ? "已付款核对"
                  : "等待自动分录确认"
                : request.status === "rejected"
                  ? "退回修改"
                  : request.status === "cancelled"
                    ? "已取消"
                    : "申请处理中",
      latestUpdatedAt: request.approvalHistory[0]?.actedAt ?? request.requestedAt,
      autoLedgerPosted: isAutoPostedRequest(state, request),
      exceptionFlag:
        request.ocrStatus === "exception_pending_confirm" || request.status === "ocr_exception_pending_confirm"
          ? "OCR异常"
          : request.status === "rejected"
            ? "已驳回"
            : isOverdueRequest(request, state)
              ? "已逾期"
              : "-",
      priorityLabel: getApprovalPriority(request),
      isOverdue: isOverdueRequest(request, state),
      latestNote: request.approvalHistory[0]?.note ?? request.purpose
    }));
}

export async function getApprovalCenterSummary(role: PaymentRoleFilter) {
  const state = await readRuntimeState();
  const requests = state.paymentRequests;
  const today = new Date().toISOString().slice(0, 10);
  const inbox = requests.filter((request) => matchesApprovalTab(request, role, "inbox")).length;
  const submitted = requests.filter((request) => matchesApprovalTab(request, role, "submitted")).length;
  const processed = requests.filter((request) => matchesApprovalTab(request, role, "processed")).length;
  const cc = requests.filter((request) => matchesApprovalTab(request, role, "cc")).length;
  const exceptions = requests.filter((request) => matchesApprovalTab(request, role, "exceptions")).length;
  const overdue = requests.filter((request) => isOverdueRequest(request, state)).length;
  const todayNew = requests.filter((request) => request.requestedAt === today).length;
  const awaitingPayment = requests.filter((request) => request.status === "approved_waiting_payment").length;
  const paidCompleted = requests.filter((request) => request.status === "paid" || isAutoPostedRequest(state, request)).length;

  return {
    inbox,
    submitted,
    processed,
    cc,
    exceptions,
    overdue,
    todayNew,
    awaitingPayment,
    paidCompleted
  };
}

export async function getApprovalRoleQueues(role: PaymentRoleFilter) {
  const state = await readRuntimeState();
  const requests = state.paymentRequests;
  const executions = state.paymentExecutions;

  if (role === "finance") {
    return [
      { label: "待审批复核", value: requests.filter((item) => item.status === "processing").length },
      { label: "待付款执行", value: requests.filter((item) => item.status === "approved_waiting_payment" || item.status === "partially_paid").length },
      { label: "已付款待核对", value: executions.filter((item) => item.verificationStatus === "pending").length }
    ];
  }

  if (role === "cashier") {
    return [
      { label: "待OCR核对", value: requests.filter((item) => item.status === "ocr_pending").length },
      { label: "OCR异常待确认", value: requests.filter((item) => item.status === "ocr_exception_pending_confirm").length },
      { label: "待付款核对", value: requests.filter((item) => item.status === "approved_waiting_payment" || item.status === "partially_paid").length }
    ];
  }

  if (role === "applicant") {
    const ownRequests = requests.filter((item) => item.applicantName === roleUserName(role));
    return [
      { label: "待处理", value: ownRequests.filter((item) => ["submitted", "ocr_pending", "processing"].includes(item.status)).length },
      { label: "待修改", value: ownRequests.filter((item) => item.status === "rejected" || item.status === "draft").length },
      {
        label: "已自动入账",
        value: ownRequests.filter((item) => isAutoPostedRequest(state, item)).length
      }
    ];
  }

  return [
    { label: "高金额待批", value: requests.filter((item) => item.status === "processing" && item.amount >= 100000).length },
    { label: "待付款关注", value: requests.filter((item) => item.status === "approved_waiting_payment").length },
    { label: "异常待看", value: requests.filter((item) => item.status === "ocr_exception_pending_confirm" || item.status === "rejected").length }
  ];
}

export async function getExecutionWorkbenchSummary(filters: {
  organization?: string;
  currency?: "RUB" | "CNY" | "USD" | "all";
} = {}) {
  const state = await readRuntimeState();
  const requests = state.paymentRequests;
  const executions = state.paymentExecutions;
  const rows = requests.filter((item) => {
    if (!["approved_waiting_payment", "partially_paid", "paid"].includes(item.status)) {
      return false;
    }
    if (filters.organization && filters.organization !== "all" && item.organization !== filters.organization) {
      return false;
    }
    if (filters.currency && filters.currency !== "all" && item.currency !== filters.currency) {
      return false;
    }
    return true;
  });

  const scopedRequestIds = new Set(rows.map((item) => item.id));
  const scopedExecutions = executions.filter((item) => scopedRequestIds.has(item.paymentRequestId));

  return {
    awaitingPayment: rows.filter((item) => item.status === "approved_waiting_payment").length,
    partialPayment: rows.filter((item) => item.status === "partially_paid").length,
    paidCompleted: rows.filter((item) => item.status === "paid").length,
    pendingVerification: scopedExecutions.filter((item) => item.verificationStatus === "pending").length,
    verifiedCompleted: rows.filter((item) => item.status === "paid" && scopedExecutions.some((execution) => execution.paymentRequestId === item.id) && scopedExecutions.filter((execution) => execution.paymentRequestId === item.id).every((execution) => execution.verificationStatus === "verified") && isAutoPostedRequest(state, item)).length,
    unpaidBalance: rows.reduce((sum, item) => sum + (item.amount - item.paidAmount), 0),
    executedAmount: rows.reduce((sum, item) => sum + item.paidAmount, 0),
    exceptionCount: scopedExecutions.filter((item) => item.verificationStatus === "exception").length
  };
}

export async function getExecutionWorkbenchRows(filters: {
  organization?: string;
  currency?: "RUB" | "CNY" | "USD" | "all";
  status?: PaymentRequestRecord["status"] | "all";
}) {
  const [requests, state] = await Promise.all([getPaymentRequests(), readRuntimeState()]);
  const bankAccounts = await getBankAccountConfigViewAsync();
  return requests
    .filter((item) => ["approved_waiting_payment", "partially_paid", "paid"].includes(item.status))
    .filter((item) => !filters.organization || filters.organization === "all" || item.organization === filters.organization)
    .filter((item) => !filters.currency || filters.currency === "all" || item.currency === filters.currency)
    .filter((item) => !filters.status || filters.status === "all" || item.status === filters.status)
    .map((item) => {
      const organizationAccounts = bankAccounts.filter((account) => account.isActive && account.organization === item.organization);
      const exactMatches = organizationAccounts.filter((account) => account.currency === item.currency);
      const availableAccounts = exactMatches.length > 0 ? exactMatches : organizationAccounts;
      const defaultBankAccount =
        availableAccounts.find((account) => account.isDefault) ??
        availableAccounts[0] ??
        null;
      const remainingAmount = item.amount - item.paidAmount;
      const executionRows = state.paymentExecutions.filter((execution) => execution.paymentRequestId === item.id);
      const latestExecution = executionRows[0] ?? null;
      const verificationException = executionRows.some((execution) => execution.verificationStatus === "exception");
      const verificationPending = executionRows.some((execution) => execution.verificationStatus === "pending");
      return {
        ...item,
        remainingAmount,
        autoLedgerPosted: isAutoPostedRequest(state, item),
        executionQueueLabel:
          verificationException
            ? "付款异常待处理"
            : item.status === "approved_waiting_payment"
            ? "待首次付款"
            : item.status === "partially_paid"
              ? "待补余款"
              : verificationPending
                ? "已付款待核对"
                : "已付款已核对",
        defaultBankAccountName: defaultBankAccount?.accountName ?? "未设置默认账户",
        defaultBankName: defaultBankAccount?.bankName ?? "-",
        latestExecutionNote: latestExecution?.verificationNote || latestExecution?.note || item.approvalHistory[0]?.note || item.purpose,
        latestExecutionReference: latestExecution?.bankReference ?? "-",
        latestVerificationStatus: latestExecution?.verificationStatus ?? "pending"
      };
    });
}

export async function getPurchaseSummary() {
  const requests = await getPurchaseRequests();
  const ledgers = await getPurchaseLedgers();
  return {
    total: requests.length,
    processing: requests.filter((item) => item.status === "processing").length,
    approved: requests.filter((item) => item.status === "approved" || item.status === "ledger_created").length,
    ledgerCreated: ledgers.length,
    requestedTotal: requests.reduce((sum, item) => sum + item.amount, 0)
  };
}

export async function getContractSummary() {
  const requests = await getContractApprovals();
  const ledgers = await getContractLedgers();
  return {
    total: requests.length,
    processing: requests.filter((item) => item.status === "processing").length,
    approved: requests.filter((item) => item.status === "approved" || item.status === "ledger_created").length,
    ledgerCreated: ledgers.length,
    approvedAmount: requests
      .filter((item) => item.status === "approved" || item.status === "ledger_created")
      .reduce((sum, item) => sum + item.amount, 0)
  };
}

function ensurePurchaseLedger(state: RuntimeState, request: PurchaseRequestRecord) {
  if (state.purchaseLedgers.some((item) => item.purchaseRequestId === request.id)) {
    return;
  }
  state.purchaseLedgers.unshift({
    id: `PL-${String(state.purchaseLedgers.length + 1).padStart(3, "0")}`,
    purchaseRequestId: request.id,
    organization: request.organization,
    supplierName: request.supplierName,
    purchaseType: request.purchaseType,
    amount: request.amount,
    currency: request.currency,
    createdAt: new Date().toISOString().slice(0, 10),
    status: request.requiresPayment ? "linked_payment" : "open",
    note: "采购审批通过后系统自动生成采购台账。"
  });
}

function ensureContractLedger(state: RuntimeState, request: ContractApprovalRecord) {
  if (state.contractLedgers.some((item) => item.contractRequestId === request.id)) {
    return;
  }
  state.contractLedgers.unshift({
    id: `CL-${String(state.contractLedgers.length + 1).padStart(3, "0")}`,
    contractRequestId: request.id,
    organization: request.organization,
    contractName: request.contractName,
    contractNo: request.contractNo,
    counterpartyName: request.counterpartyName,
    amount: request.amount,
    currency: request.currency,
    effectiveDate: request.effectiveDate,
    expiryDate: request.expiryDate,
    status: "active",
    note: "合同审批通过后系统自动生成合同台账。"
  });
}

export async function updatePurchaseRequestStatus(
  requestId: string,
  action: "approve" | "reject" | "cancel",
  options?: { actor?: string; note?: string }
) {
  const state = await readRuntimeState();
  const request = state.purchaseRequests.find((item) => item.id === requestId);
  if (!request) {
    throw new Error("purchase request not found");
  }
  if (action === "approve" && request.status === "processing") {
    request.status = "approved";
    request.currentApprovalNode = null;
    request.currentHandler = "采购台账";
    request.approvalHistory.unshift({
      id: nextHistoryId(request.approvalHistory.length + 1),
      action: "审批通过",
      node: request.currentApprovalNode,
      actor: options?.actor?.trim() || "审批人",
      result: "通过",
      note: options?.note?.trim() || "采购申请审批通过。",
      actedAt: nowStamp()
    });
    ensurePurchaseLedger(state, request);
  }
  if (action === "reject" && request.status === "processing") {
    request.status = "rejected";
    request.currentApprovalNode = null;
    request.currentHandler = request.applicantName;
    request.approvalHistory.unshift({
      id: nextHistoryId(request.approvalHistory.length + 1),
      action: "审批驳回",
      node: null,
      actor: options?.actor?.trim() || "审批人",
      result: "驳回",
      note: options?.note?.trim() || "采购申请退回修改。",
      actedAt: nowStamp()
    });
  }
  if (action === "cancel" && ["draft", "submitted", "processing"].includes(request.status)) {
    request.status = "cancelled";
    request.currentApprovalNode = null;
    request.currentHandler = null;
    request.approvalHistory.unshift({
      id: nextHistoryId(request.approvalHistory.length + 1),
      action: "申请取消",
      node: null,
      actor: options?.actor?.trim() || request.applicantName,
      result: "已取消",
      note: options?.note?.trim() || "采购申请已取消。",
      actedAt: nowStamp()
    });
  }
  await writeRuntimeState(state);
  return request;
}

export async function updateContractApprovalStatus(
  requestId: string,
  action: "approve" | "reject" | "cancel",
  options?: { actor?: string; note?: string }
) {
  const state = await readRuntimeState();
  const request = state.contractApprovals.find((item) => item.id === requestId);
  if (!request) {
    throw new Error("contract request not found");
  }
  if (action === "approve" && request.status === "processing") {
    request.status = "approved";
    request.currentApprovalNode = null;
    request.currentHandler = "合同台账";
    request.approvalHistory.unshift({
      id: nextHistoryId(request.approvalHistory.length + 1),
      action: "审批通过",
      node: request.currentApprovalNode,
      actor: options?.actor?.trim() || "审批人",
      result: "通过",
      note: options?.note?.trim() || "合同审批通过。",
      actedAt: nowStamp()
    });
    ensureContractLedger(state, request);
  }
  if (action === "reject" && request.status === "processing") {
    request.status = "rejected";
    request.currentApprovalNode = null;
    request.currentHandler = request.applicantName;
    request.approvalHistory.unshift({
      id: nextHistoryId(request.approvalHistory.length + 1),
      action: "审批驳回",
      node: null,
      actor: options?.actor?.trim() || "审批人",
      result: "驳回",
      note: options?.note?.trim() || "合同审批退回修改。",
      actedAt: nowStamp()
    });
  }
  if (action === "cancel" && ["draft", "submitted", "ocr_pending", "processing"].includes(request.status)) {
    request.status = "cancelled";
    request.currentApprovalNode = null;
    request.currentHandler = null;
    request.approvalHistory.unshift({
      id: nextHistoryId(request.approvalHistory.length + 1),
      action: "申请取消",
      node: null,
      actor: options?.actor?.trim() || request.applicantName,
      result: "已取消",
      note: options?.note?.trim() || "合同审批已取消。",
      actedAt: nowStamp()
    });
  }
  await writeRuntimeState(state);
  return request;
}

export function getApprovalFlowProgress(request: PaymentRequestRecord) {
  const flow = request.flowTemplateId
    ? getApprovalFlowTemplatesView().find((item) => item.id === request.flowTemplateId) ?? null
    : null;
  if (!flow) {
    return [];
  }

  return flow.nodes.map((node) => {
    const acted = request.approvalHistory.find((item) => item.node === node.name && item.action === "审批通过");
    const rejected = request.approvalHistory.find((item) => item.node === node.name && item.action === "审批驳回");
    const isCurrent = request.currentApprovalNode === node.name;
    return {
      id: node.id,
      name: node.name,
      approver: resolveHandlerLabel(node) ?? node.approverValue,
      status: rejected ? "rejected" : acted ? "completed" : isCurrent ? "current" : "pending"
    };
  });
}

export async function getPaymentRequestById(requestId: string) {
  const state = await readRuntimeState();
  return state.paymentRequests.find((item) => item.id === requestId) ?? null;
}

export async function getExecutionsByRequestId(requestId: string) {
  const state = await readRuntimeState();
  return state.paymentExecutions.filter((item) => item.paymentRequestId === requestId);
}

export async function getLedgerEntriesByRequestId(requestId: string) {
  const state = await readRuntimeState();
  return state.ledgerEntries.filter((item) => item.paymentRequestId === requestId);
}

export async function getAllLedgerEntries() {
  const state = await readRuntimeState();
  return state.ledgerEntries;
}

type ReportFilters = {
  organization?: string;
  month?: string;
};

function matchesReportFilters(
  entry: { organization: string; businessDate: string },
  filters: ReportFilters = {}
) {
  if (filters.organization && filters.organization !== "all" && entry.organization !== filters.organization) {
    return false;
  }
  if (filters.month && !entry.businessDate.startsWith(filters.month)) {
    return false;
  }
  return true;
}

function classifyAccountGroup(accountCode: string) {
  if (accountCode.startsWith("64")) return "预付款";
  if (accountCode.startsWith("66")) return "费用";
  if (accountCode.startsWith("68")) return "内部往来";
  return "其他";
}

function resolveLedgerScenario(
  request: Pick<PaymentRequestRecord, "isInternal" | "currency">,
  organization: { enableExchangeRate: boolean; settlementRole: string; baseCurrency: "RUB" | "CNY" | "USD" }
) {
  if (request.isInternal) {
    return "internal_transfer" as const;
  }
  if (
    organization.enableExchangeRate &&
    request.currency !== organization.baseCurrency &&
    organization.settlementRole === "import"
  ) {
    return "import_foreign_payment" as const;
  }
  return "standard_payment" as const;
}

function resolveLedgerAccount(
  request: Pick<PaymentRequestRecord, "isInternal" | "currency">,
  organization: { enableExchangeRate: boolean; settlementRole: string; baseCurrency: "RUB" | "CNY" | "USD"; displayName?: string }
) {
  const scenario = resolveLedgerScenario(request, organization);
  const mapping = getLedgerAccountMappingView().find(
    (item) =>
      item.isActive &&
      item.scenario === scenario &&
      (!organization.displayName || item.organizationScope.includes(organization.displayName))
  );
  if (mapping) {
    return { accountCode: mapping.accountCode, accountName: mapping.accountName };
  }
  return scenario === "internal_transfer"
    ? { accountCode: "6801", accountName: "内部往来支出" }
    : scenario === "import_foreign_payment"
      ? { accountCode: "6401", accountName: "进口采购预付款" }
      : { accountCode: "6601", accountName: "付款申请支出" };
}

async function resolveLedgerAccountAsync(
  request: Pick<PaymentRequestRecord, "isInternal" | "currency">,
  organization: { enableExchangeRate: boolean; settlementRole: string; baseCurrency: "RUB" | "CNY" | "USD"; displayName?: string }
) {
  const scenario = resolveLedgerScenario(request, organization);
  const mappings = await getLedgerAccountMappingViewAsync();
  const mapping = mappings.find(
    (item) =>
      item.isActive &&
      item.scenario === scenario &&
      (!organization.displayName || item.organizationScope.includes(organization.displayName))
  );
  if (mapping) {
    return { accountCode: mapping.accountCode, accountName: mapping.accountName };
  }
  return resolveLedgerAccount(request, organization);
}

function ensureApprovedRequestLedgerEntry(
  state: RuntimeState,
  request: PaymentRequestRecord,
  options?: {
    actor?: string;
    note?: string;
  }
) {
  const existing = state.ledgerEntries.find(
    (item) => item.paymentRequestId === request.id && item.sourceType === "payment_request_approval"
  );
  if (existing) {
    return;
  }

  const organization = getOrganizationByName(request.organization);
  if (!organization) {
    throw new Error("organization not found");
  }
  const businessDate = new Date().toISOString().slice(0, 10);
  const exchangeRate = getEffectiveExchangeRate(request.organization, request.currency, businessDate);
  const functionalAmount =
    request.currency === organization.baseCurrency ? request.amount : Number((request.amount * exchangeRate).toFixed(2));
  const ledgerAccount = resolveLedgerAccount({ ...request }, { ...organization, displayName: request.organization });

  state.ledgerEntries.unshift({
    id: `LE-${String(state.ledgerEntries.length + 1).padStart(3, "0")}`,
    paymentRequestId: request.id,
    sourceType: "payment_request_approval",
    sourceNo: request.id,
    organization: request.organization,
    projectName: request.projectName,
    businessDate,
    currency: request.currency,
    originalAmount: request.amount,
    exchangeRate,
    functionalAmount,
    direction: "outflow",
    accountCode: ledgerAccount.accountCode,
    accountName: ledgerAccount.accountName,
    summary:
      request.currency === organization.baseCurrency
        ? `${request.title} 审批通过后自动入账`
        : `${request.title} 审批通过后自动入账，按 ${exchangeRate} 折算为 ${organization.baseCurrency}`
  });

  request.approvalHistory.unshift({
    id: nextHistoryId(request.approvalHistory.length + 1),
    action: "系统自动入账",
    node: null,
    actor: options?.actor?.trim() || "系统",
    result: "已自动入账",
    note: options?.note?.trim() || "审批通过后系统已按组织科目自动入账",
    actedAt: nowStamp(),
  });
}

async function ensureApprovedRequestLedgerEntryAsync(
  state: RuntimeState,
  request: PaymentRequestRecord,
  options?: {
    actor?: string;
    note?: string;
  }
) {
  const existing = state.ledgerEntries.find(
    (item) => item.paymentRequestId === request.id && item.sourceType === "payment_request_approval"
  );
  if (existing) {
    return;
  }

  const organization = await getOrganizationByNameAsync(request.organization);
  if (!organization) {
    throw new Error("organization not found");
  }
  const businessDate = new Date().toISOString().slice(0, 10);
  const exchangeRate = await getEffectiveExchangeRateAsync(request.organization, request.currency, businessDate);
  const functionalAmount =
    request.currency === organization.baseCurrency ? request.amount : Number((request.amount * exchangeRate).toFixed(2));
  const ledgerAccount = await resolveLedgerAccountAsync({ ...request }, { ...organization, displayName: request.organization });

  state.ledgerEntries.unshift({
    id: `LE-${String(state.ledgerEntries.length + 1).padStart(3, "0")}`,
    paymentRequestId: request.id,
    sourceType: "payment_request_approval",
    sourceNo: request.id,
    organization: request.organization,
    projectName: request.projectName,
    businessDate,
    currency: request.currency,
    originalAmount: request.amount,
    exchangeRate,
    functionalAmount,
    direction: "outflow",
    accountCode: ledgerAccount.accountCode,
    accountName: ledgerAccount.accountName,
    summary:
      request.currency === organization.baseCurrency
        ? `${request.title} 审批通过后自动入账`
        : `${request.title} 审批通过后自动入账，按 ${exchangeRate} 折算为 ${organization.baseCurrency}`
  });

  request.approvalHistory.unshift({
    id: nextHistoryId(request.approvalHistory.length + 1),
    action: "系统自动入账",
    node: null,
    actor: options?.actor?.trim() || "系统",
    result: "已自动入账",
    note: options?.note?.trim() || "审批通过后系统已按组织科目自动入账",
    actedAt: nowStamp(),
  });
}

export async function getLedgerSummary(filters: ReportFilters = {}) {
  const ledgerEntries = (await getAllLedgerEntries()).filter((entry) => matchesReportFilters(entry, filters));
  const state = await readRuntimeState();
  const outflow = ledgerEntries
    .filter((entry) => entry.direction === "outflow")
    .reduce((sum, entry) => sum + entry.functionalAmount, 0);
  const inflow = ledgerEntries
    .filter((entry) => entry.direction === "inflow")
    .reduce((sum, entry) => sum + entry.functionalAmount, 0);

  return {
    entryCount: ledgerEntries.length,
    outflow,
    inflow,
    netCashflow: inflow - outflow,
    organizationCount: new Set(ledgerEntries.map((entry) => entry.organization)).size,
    accountCount: new Set(ledgerEntries.map((entry) => entry.accountCode)).size,
    autoPostedCount: ledgerEntries.filter((entry) => entry.sourceType === "payment_request_approval").length,
    foreignCurrencyCount: ledgerEntries.filter((entry) => entry.currency !== "RUB").length,
    verifiedExecutionCount: state.paymentExecutions.filter((item) => item.verificationStatus === "verified").length,
    executionExceptionCount: state.paymentExecutions.filter((item) => item.verificationStatus === "exception").length
  };
}

export async function getLedgerAccountRows(filters: ReportFilters = {}) {
  const ledgerEntries = (await getAllLedgerEntries()).filter((entry) => matchesReportFilters(entry, filters));
  return ledgerEntries.reduce<
    Array<{
      accountCode: string;
      accountName: string;
      accountGroup: string;
      entryCount: number;
      outflow: number;
      inflow: number;
      balance: number;
    }>
  >((rows, entry) => {
    const existing = rows.find((row) => row.accountCode === entry.accountCode);
    const amount = entry.functionalAmount;
    if (existing) {
      existing.entryCount += 1;
      if (entry.direction === "outflow") {
        existing.outflow += amount;
        existing.balance -= amount;
      } else {
        existing.inflow += amount;
        existing.balance += amount;
      }
      return rows;
    }

    rows.push({
      accountCode: entry.accountCode,
      accountName: entry.accountName,
      accountGroup: classifyAccountGroup(entry.accountCode),
      entryCount: 1,
      outflow: entry.direction === "outflow" ? amount : 0,
      inflow: entry.direction === "inflow" ? amount : 0,
      balance: entry.direction === "inflow" ? amount : -amount
    });
    return rows;
    }, []).sort((a, b) => a.accountCode.localeCompare(b.accountCode));
}

export async function getLedgerAccountGroupRows(filters: ReportFilters = {}) {
  const accountRows = await getLedgerAccountRows(filters);
  return accountRows.reduce<
    Array<{
      accountGroup: string;
      entryCount: number;
      inflow: number;
      outflow: number;
      balance: number;
    }>
  >((rows, row) => {
    const existing = rows.find((item) => item.accountGroup === row.accountGroup);
    if (existing) {
      existing.entryCount += row.entryCount;
      existing.inflow += row.inflow;
      existing.outflow += row.outflow;
      existing.balance += row.balance;
      return rows;
    }
    rows.push({
      accountGroup: row.accountGroup,
      entryCount: row.entryCount,
      inflow: row.inflow,
      outflow: row.outflow,
      balance: row.balance
    });
    return rows;
  }, []);
}

export async function getLedgerSourceRows(filters: ReportFilters = {}) {
  const ledgerEntries = (await getAllLedgerEntries()).filter((entry) => matchesReportFilters(entry, filters));
  return ledgerEntries.reduce<
    Array<{
      sourceType: string;
      entryCount: number;
      outflow: number;
      inflow: number;
    }>
  >((rows, entry) => {
    const existing = rows.find((item) => item.sourceType === entry.sourceType);
    if (existing) {
      existing.entryCount += 1;
      if (entry.direction === "outflow") {
        existing.outflow += entry.functionalAmount;
      } else {
        existing.inflow += entry.functionalAmount;
      }
      return rows;
    }
    rows.push({
      sourceType: entry.sourceType,
      entryCount: 1,
      outflow: entry.direction === "outflow" ? entry.functionalAmount : 0,
      inflow: entry.direction === "inflow" ? entry.functionalAmount : 0
    });
    return rows;
  }, []);
}

export async function getLedgerMonthOptions() {
  const entries = await getAllLedgerEntries();
  return Array.from(new Set(entries.map((entry) => entry.businessDate.slice(0, 7)))).sort().reverse();
}

export async function getCashflowStatementRows(filters: ReportFilters = {}) {
  const [ledgerEntries, bankRows] = await Promise.all([
    getAllLedgerEntries(),
    getBankAccountReportRowsAsync()
  ]);
  const scopedLedgerEntries = ledgerEntries.filter((entry) => matchesReportFilters(entry, filters));
  const periodOutflow = ledgerEntries
    .filter((entry) => entry.direction === "outflow" && matchesReportFilters(entry, filters))
    .reduce((sum, entry) => sum + entry.functionalAmount, 0);
  const periodInflow = ledgerEntries
    .filter((entry) => entry.direction === "inflow" && matchesReportFilters(entry, filters))
    .reduce((sum, entry) => sum + entry.functionalAmount, 0);
  const closingBalance = bankRows
    .filter((row) => row.currency === "RUB" && (!filters.organization || filters.organization === "all" || row.organization === filters.organization))
    .reduce((sum, row) => sum + row.totalBalance, 0);
  const openingBalance = closingBalance - periodInflow + periodOutflow;

  return [
    { label: "期初余额", amount: openingBalance },
    { label: "本期流入", amount: periodInflow },
    { label: "本期流出", amount: periodOutflow },
    { label: "期末余额", amount: closingBalance },
    { label: "本期分录数", amount: scopedLedgerEntries.length }
  ];
}

export async function getCashflowCompositionRows(filters: ReportFilters = {}) {
  const ledgerEntries = (await getAllLedgerEntries()).filter((entry) => matchesReportFilters(entry, filters));
  const standardOutflow = ledgerEntries
    .filter((entry) => entry.sourceType === "payment_request_approval" && entry.accountCode.startsWith("66"))
    .reduce((sum, entry) => sum + entry.functionalAmount, 0);
  const importOutflow = ledgerEntries
    .filter((entry) => entry.sourceType === "payment_request_approval" && entry.accountCode.startsWith("64"))
    .reduce((sum, entry) => sum + entry.functionalAmount, 0);
  const internalOutflow = ledgerEntries
    .filter((entry) => entry.sourceType === "payment_request_approval" && entry.accountCode.startsWith("68"))
    .reduce((sum, entry) => sum + entry.functionalAmount, 0);
  return [
    { label: "标准付款流出", amount: standardOutflow },
    { label: "进口预付款流出", amount: importOutflow },
    { label: "内部往来流出", amount: internalOutflow }
  ];
}

export async function getProfitStatementRows(filters: ReportFilters = {}) {
  const accountRows = await getLedgerAccountRows(filters);
  return accountRows.map((row) => ({
    accountCode: row.accountCode,
    accountName: row.accountName,
    accountGroup: row.accountGroup,
    expenseAmount: row.outflow,
    incomeAmount: row.inflow,
    profitImpact: row.inflow - row.outflow
  }));
}

export async function getBalanceSheetRows(filters: ReportFilters = {}) {
  const [bankRows, paymentRequests, ledgerEntries] = await Promise.all([
    getBankAccountReportRowsAsync(),
    getPaymentRequests(),
    getAllLedgerEntries()
  ]);
  const bankBalance = bankRows
    .filter((row) => row.currency === "RUB" && (!filters.organization || filters.organization === "all" || row.organization === filters.organization))
    .reduce((sum, row) => sum + row.totalBalance, 0);
  const internalReceivables = paymentRequests
    .filter((item) => item.isInternal && item.status !== "cancelled" && (!filters.organization || filters.organization === "all" || item.organization === filters.organization))
    .reduce((sum, item) => sum + (item.amount - item.paidAmount), 0);
  const prepaidExpenses = ledgerEntries
    .filter((item) => item.accountCode.startsWith("64") && matchesReportFilters(item, filters))
    .reduce((sum, item) => sum + item.functionalAmount, 0);
  const expenseAccumulation = ledgerEntries
    .filter((item) => (item.accountCode.startsWith("66") || item.accountCode.startsWith("68")) && matchesReportFilters(item, filters))
    .reduce((sum, item) => sum + item.functionalAmount, 0);

  return {
    assets: [
      { label: "银行存款", amount: bankBalance },
      { label: "预付款项", amount: prepaidExpenses },
      { label: "内部往来", amount: internalReceivables }
    ],
    liabilities: [{ label: "待付款申请", amount: paymentRequests.reduce((sum, item) => sum + (item.amount - item.paidAmount), 0) }],
    equity: [{ label: "累计费用影响", amount: -expenseAccumulation }]
  };
}

function getPreviousMonth(month: string) {
  const [yearText, monthText] = month.split("-");
  const year = Number(yearText);
  const monthNumber = Number(monthText);
  if (!year || !monthNumber) {
    return null;
  }
  const date = new Date(Date.UTC(year, monthNumber - 1, 1));
  date.setUTCMonth(date.getUTCMonth() - 1);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export async function getReportComparison(filters: ReportFilters = {}) {
  const targetMonth = filters.month || (await getLedgerMonthOptions())[0] || null;
  if (!targetMonth) {
    return null;
  }
  const previousMonth = getPreviousMonth(targetMonth);
  const paymentRequests = await getPaymentRequests();
  const currentRequests = paymentRequests.filter(
    (item) =>
      item.requestedAt.startsWith(targetMonth) &&
      (!filters.organization || filters.organization === "all" || item.organization === filters.organization)
  );
  const previousRequests = previousMonth
    ? paymentRequests.filter(
        (item) =>
          item.requestedAt.startsWith(previousMonth) &&
          (!filters.organization || filters.organization === "all" || item.organization === filters.organization)
      )
    : [];
  const currentLedger = await getLedgerSummary({ ...filters, month: targetMonth });
  const previousLedger = previousMonth ? await getLedgerSummary({ ...filters, month: previousMonth }) : null;
  return {
    currentMonth: targetMonth,
    previousMonth,
    requestedDelta: currentRequests.reduce((sum, item) => sum + item.amount, 0) - previousRequests.reduce((sum, item) => sum + item.amount, 0),
    paidDelta: currentRequests.reduce((sum, item) => sum + item.paidAmount, 0) - previousRequests.reduce((sum, item) => sum + item.paidAmount, 0),
    outflowDelta: currentLedger.outflow - (previousLedger?.outflow ?? 0),
    autoPostedDelta: currentLedger.autoPostedCount - (previousLedger?.autoPostedCount ?? 0)
  };
}

export function getExchangeRateConfigView() {
  return readConfigRuntimeState().exchangeRates;
}

export async function getExchangeRateConfigViewAsync() {
  return (await readConfigState()).exchangeRates;
}

export function getLedgerAccountMappingView() {
  return readConfigRuntimeState().ledgerAccountMappings;
}

export async function getLedgerAccountMappingViewAsync() {
  return (await readConfigState()).ledgerAccountMappings;
}

export function getLedgerAccountMappingSummary() {
  const rows = getLedgerAccountMappingView();
  return {
    totalMappings: rows.length,
    activeMappings: rows.filter((item) => item.isActive).length,
    coveredOrganizations: new Set(rows.flatMap((item) => item.organizationScope)).size,
    scenarios: new Set(rows.map((item) => item.scenario)).size
  };
}

export async function getLedgerAccountMappingSummaryAsync() {
  const rows = await getLedgerAccountMappingViewAsync();
  return {
    totalMappings: rows.length,
    activeMappings: rows.filter((item) => item.isActive).length,
    coveredOrganizations: new Set(rows.flatMap((item) => item.organizationScope)).size,
    scenarios: new Set(rows.map((item) => item.scenario)).size
  };
}

export function getExchangeRateSummary() {
  const rows = getExchangeRateConfigView();
  return {
    totalRates: rows.length,
    activeRates: rows.filter((item) => item.isActive).length,
    coveredOrganizations: new Set(rows.flatMap((item) => item.organizationScope)).size,
    currencyPairs: new Set(rows.map((item) => `${item.fromCurrency}-${item.toCurrency}`)).size
  };
}

export async function getExchangeRateSummaryAsync() {
  const rows = await getExchangeRateConfigViewAsync();
  return {
    totalRates: rows.length,
    activeRates: rows.filter((item) => item.isActive).length,
    coveredOrganizations: new Set(rows.flatMap((item) => item.organizationScope)).size,
    currencyPairs: new Set(rows.map((item) => `${item.fromCurrency}-${item.toCurrency}`)).size
  };
}

export function getExchangeRateReportRows() {
  return getExchangeRateConfigView()
    .slice()
    .sort((a, b) => {
      if (a.effectiveDate === b.effectiveDate) {
        return a.fromCurrency.localeCompare(b.fromCurrency);
      }
      return b.effectiveDate.localeCompare(a.effectiveDate);
    });
}

export async function getExchangeRateReportRowsAsync() {
  const rows = await getExchangeRateConfigViewAsync();
  return rows
    .slice()
    .sort((a, b) => {
      if (a.effectiveDate === b.effectiveDate) {
        return a.fromCurrency.localeCompare(b.fromCurrency);
      }
      return b.effectiveDate.localeCompare(a.effectiveDate);
    });
}

export function getEffectiveExchangeRate(
  organizationName: string,
  fromCurrency: "RUB" | "CNY" | "USD",
  businessDate: string
) {
  const organization = getOrganizationByName(organizationName);
  if (!organization) {
    return 1;
  }
  if (fromCurrency === organization.baseCurrency) {
    return 1;
  }
  if (!organization.enableExchangeRate) {
    return 1;
  }
  const exactMatch = getExchangeRateConfigView()
    .filter(
      (item) =>
        item.isActive &&
        item.organizationScope.includes(organizationName) &&
        item.fromCurrency === fromCurrency &&
        item.toCurrency === organization.baseCurrency &&
        item.effectiveDate <= businessDate
    )
    .sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate))[0];

  if (exactMatch) {
    return exactMatch.rate;
  }

  const fallback = getExchangeRateConfigView()
    .filter(
      (item) =>
        item.isActive &&
        item.organizationScope.includes(organizationName) &&
        item.fromCurrency === fromCurrency &&
        item.toCurrency === organization.baseCurrency
    )
    .sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate))[0];

  return fallback?.rate ?? 1;
}

export async function getEffectiveExchangeRateAsync(
  organizationName: string,
  fromCurrency: "RUB" | "CNY" | "USD",
  businessDate: string
) {
  const organization = await getOrganizationByNameAsync(organizationName);
  if (!organization) {
    return 1;
  }
  if (fromCurrency === organization.baseCurrency) {
    return 1;
  }
  if (!organization.enableExchangeRate) {
    return 1;
  }
  const rates = await getExchangeRateConfigViewAsync();
  const exactMatch = rates
    .filter(
      (item) =>
        item.isActive &&
        item.organizationScope.includes(organizationName) &&
        item.fromCurrency === fromCurrency &&
        item.toCurrency === organization.baseCurrency &&
        item.effectiveDate <= businessDate
    )
    .sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate))[0];

  if (exactMatch) {
    return exactMatch.rate;
  }

  const fallback = rates
    .filter(
      (item) =>
        item.isActive &&
        item.organizationScope.includes(organizationName) &&
        item.fromCurrency === fromCurrency &&
        item.toCurrency === organization.baseCurrency
    )
    .sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate))[0];

  return fallback?.rate ?? 1;
}

export async function getDashboardMetrics() {
  const [state, organizations, bankAccounts] = await Promise.all([
    readRuntimeState(),
    getOrganizationConfigViewAsync(),
    getBankAccountConfigViewAsync()
  ]);
  const groupedOrganizations = new Set(
    organizations
      .filter((item) => item.isActive && item.includeInGroupReport)
      .map((item) => item.displayName)
  );
  const totalFunds = bankAccounts
    .filter((account) => account.isActive && groupedOrganizations.has(account.organization) && account.currency === "RUB")
    .reduce((sum, account) => sum + account.balance, 0);
  const pendingApprovals = state.paymentRequests.filter((request) =>
    ["submitted", "ocr_pending", "ocr_exception_pending_confirm", "processing", "approved_waiting_payment", "partially_paid"].includes(request.status)
  ).length;
  const ocrExceptions = state.paymentRequests.filter((request) => request.ocrStatus === "exception_pending_confirm").length;
  const weekOutflow = state.ledgerEntries
    .filter((entry) => entry.direction === "outflow")
    .reduce((sum, entry) => sum + entry.functionalAmount, 0);

  return {
    totalFunds,
    pendingApprovals,
    ocrExceptions,
    weekOutflow
  };
}

export async function getPaymentWorkflowSummary() {
  const state = await readRuntimeState();
  const paymentRequests = state.paymentRequests;
  return {
    total: paymentRequests.length,
    awaitingApproval: paymentRequests.filter((item) =>
      ["submitted", "ocr_pending", "ocr_exception_pending_confirm", "processing"].includes(item.status)
    ).length,
    awaitingPayment: paymentRequests.filter((item) => item.status === "approved_waiting_payment").length,
    partiallyPaid: paymentRequests.filter((item) => item.status === "partially_paid").length,
    posted: paymentRequests.filter((item) => isAutoPostedRequest(state, item)).length
  };
}

export async function getFilteredPaymentWorkflowSummary(filters: PaymentListFilters = {}) {
  const state = await readRuntimeState();
  const paymentRequests = (await getFilteredPaymentRequests(filters));
  return {
    total: paymentRequests.length,
    awaitingApproval: paymentRequests.filter((item) =>
      ["submitted", "ocr_pending", "ocr_exception_pending_confirm", "processing"].includes(item.status)
    ).length,
    awaitingPayment: paymentRequests.filter((item) => item.status === "approved_waiting_payment").length,
    partiallyPaid: paymentRequests.filter((item) => item.status === "partially_paid").length,
    posted: paymentRequests.filter((item) => isAutoPostedRequest(state, item)).length
  };
}

export async function createPaymentRequest(input: {
  title: string;
  applicantName: string;
  organization: string;
  projectName: string | null;
  paymentPartyType: PaymentRequestRecord["paymentPartyType"];
  paymentPartyName: string;
  paymentPartyBank: string;
  paymentPartyAccount: string;
  currency: PaymentRequestRecord["currency"];
  amount: number;
  purpose: string;
  isInternal: boolean;
  internalTarget: string | null;
  submit: boolean;
}) {
  const state = await readRuntimeState();
  const organization = await getOrganizationByNameAsync(input.organization);
  if (!organization || !organization.isActive) {
    throw new Error("organization is not active");
  }
  const requestNumber = `PAY-2026-${String(state.paymentRequests.length + 1).padStart(4, "0")}`;
  const selectedFlow = await selectApprovalFlowAsync(input.organization, input.isInternal, input.currency);
  const firstNode = selectedFlow?.nodes[0] ?? null;
  const nextRequest: PaymentRequestRecord = {
    id: requestNumber,
    title: input.title,
    organization: input.organization,
    projectName: input.projectName,
    applicantName: input.applicantName,
    requestedAt: new Date().toISOString().slice(0, 10),
    purpose: input.purpose,
    amount: input.amount,
    paidAmount: 0,
    currency: input.currency,
    status: input.submit ? "ocr_pending" : "draft",
    paymentPartyName: input.paymentPartyName,
    paymentPartyType: input.paymentPartyType,
    paymentPartyBank: input.paymentPartyBank,
    paymentPartyAccount: input.paymentPartyAccount,
    isInternal: input.isInternal,
    internalTarget: input.internalTarget,
    flowTemplateId: selectedFlow?.id ?? null,
    flowTemplateName: selectedFlow?.name ?? null,
    currentApprovalNode: input.submit ? firstNode?.name ?? null : null,
    currentHandler: input.submit ? resolveHandlerLabel(firstNode) : null,
    ccUsers: firstNode?.ccList ?? [],
    approvalHistory: [
      {
        id: nextHistoryId(1),
        action: input.submit ? "提交申请" : "保存草稿",
        node: input.submit ? firstNode?.name ?? null : null,
        actor: input.applicantName,
        result: input.submit ? "已提交" : "草稿保存",
        note: input.purpose,
        actedAt: nowStamp(),
      }
    ],
    ocrStatus: input.submit ? "processing" : "not_started",
    ocrResult: input.submit ? null : null,
    attachments: {
      invoice: ["demo-invoice.pdf"],
      contract: ["demo-contract.pdf"],
      voucher: [],
      other: []
    }
  };
  state.paymentRequests.unshift(nextRequest);
  await writeRuntimeState(state);
  return nextRequest;
}

export async function updatePaymentRequestDraft(
  requestId: string,
  input: {
    title: string;
    applicantName: string;
    organization: string;
    projectName: string | null;
    paymentPartyType: PaymentRequestRecord["paymentPartyType"];
    paymentPartyName: string;
    paymentPartyBank: string;
    paymentPartyAccount: string;
    currency: PaymentRequestRecord["currency"];
    amount: number;
    purpose: string;
    isInternal: boolean;
    internalTarget: string | null;
    submit: boolean;
  }
) {
  const state = await readRuntimeState();
  const request = state.paymentRequests.find((item) => item.id === requestId);
  if (!request) {
    throw new Error("request not found");
  }
  const organization = await getOrganizationByNameAsync(input.organization);
  if (!organization || !organization.isActive) {
    throw new Error("organization is not active");
  }
  if (!["draft", "rejected"].includes(request.status)) {
    throw new Error("request is not editable");
  }

  const selectedFlow = await selectApprovalFlowAsync(input.organization, input.isInternal, input.currency);
  const firstNode = selectedFlow?.nodes[0] ?? null;

  request.title = input.title;
  request.organization = input.organization;
  request.projectName = input.projectName;
  request.applicantName = input.applicantName;
  request.purpose = input.purpose;
  request.amount = input.amount;
  request.currency = input.currency;
  request.paymentPartyName = input.paymentPartyName;
  request.paymentPartyType = input.paymentPartyType;
  request.paymentPartyBank = input.paymentPartyBank;
  request.paymentPartyAccount = input.paymentPartyAccount;
  request.isInternal = input.isInternal;
  request.internalTarget = input.internalTarget;
  request.flowTemplateId = selectedFlow?.id ?? null;
  request.flowTemplateName = selectedFlow?.name ?? null;
  request.currentApprovalNode = input.submit ? firstNode?.name ?? null : null;
  request.currentHandler = input.submit ? resolveHandlerLabel(firstNode) : input.applicantName;
  request.ccUsers = input.submit ? firstNode?.ccList ?? [] : [];
  request.status = input.submit ? "ocr_pending" : "draft";
  request.ocrStatus = input.submit ? "processing" : "not_started";
  request.ocrResult = null;
  request.approvalHistory.unshift({
    id: nextHistoryId(request.approvalHistory.length + 1),
    action: input.submit ? "重新提交" : "草稿更新",
    node: input.submit ? firstNode?.name ?? null : null,
    actor: input.applicantName,
    result: input.submit ? "已重新提交" : "草稿已更新",
    note: input.purpose,
    actedAt: nowStamp(),
  });

  await writeRuntimeState(state);
  return request;
}

export async function updatePaymentRequestStatus(
  requestId: string,
  action: "ocr_match" | "ocr_flag_exception" | "ocr_exception_confirm" | "approve" | "reject" | "cancel" | "return_to_draft",
  options?: {
    actor?: string;
    note?: string;
  }
) {
  const state = await readRuntimeState();
  const request = state.paymentRequests.find((item) => item.id === requestId);
  if (!request) {
    throw new Error("request not found");
  }
  const flowTemplates = await getApprovalFlowTemplatesViewAsync();
  const flow = request.flowTemplateId ? flowTemplates.find((item) => item.id === request.flowTemplateId) ?? null : null;

  if (action === "ocr_match" && request.status === "ocr_pending") {
    request.ocrResult = createOcrResult(request, "matched");
    request.ocrStatus = "matched";
    request.status = "processing";
    request.approvalHistory.unshift({
      id: nextHistoryId(request.approvalHistory.length + 1),
      action: "OCR核对",
      node: "OCR 核对",
      actor: options?.actor?.trim() || "系统",
      result: "识别一致",
      note: options?.note?.trim() || "关键字段核对通过",
      actedAt: nowStamp(),
    });
    if (flow?.nodes[1]) {
      request.currentApprovalNode = flow.nodes[1].name;
      request.currentHandler = resolveHandlerLabel(flow.nodes[1]);
      request.ccUsers = flow.nodes[1].ccList;
    }
  }

  if (action === "ocr_flag_exception" && request.status === "ocr_pending") {
    request.ocrResult = createOcrResult(request, "exception");
    request.ocrStatus = "exception_pending_confirm";
    request.status = "ocr_exception_pending_confirm";
    request.approvalHistory.unshift({
      id: nextHistoryId(request.approvalHistory.length + 1),
      action: "OCR核对",
      node: "OCR 核对",
      actor: options?.actor?.trim() || "出纳",
      result: "异常待确认",
      note: options?.note?.trim() || "识别结果与单据字段不一致，转人工确认",
      actedAt: nowStamp(),
    });
  }

  if (action === "ocr_exception_confirm" && request.status === "ocr_exception_pending_confirm") {
    request.ocrResult = request.ocrResult ?? createOcrResult(request, "exception");
    request.ocrStatus = "confirmed_exception";
    request.status = "processing";
    request.approvalHistory.unshift({
      id: nextHistoryId(request.approvalHistory.length + 1),
      action: "OCR异常确认",
      node: "OCR 核对",
      actor: options?.actor?.trim() || "出纳",
      result: "异常已确认",
      note: options?.note?.trim() || "人工确认后继续审批",
      actedAt: nowStamp(),
    });
    if (flow?.nodes[1]) {
      request.currentApprovalNode = flow.nodes[1].name;
      request.currentHandler = resolveHandlerLabel(flow.nodes[1]);
      request.ccUsers = flow.nodes[1].ccList;
    }
  }

  if (action === "approve" && request.status === "processing") {
    const currentIndex = flow?.nodes.findIndex((node) => node.name === request.currentApprovalNode) ?? -1;
    const currentNodeName = request.currentApprovalNode;
    const currentActor = request.currentHandler ?? "审批人";
    request.approvalHistory.unshift({
      id: nextHistoryId(request.approvalHistory.length + 1),
      action: "审批通过",
      node: currentNodeName,
      actor: options?.actor?.trim() || currentActor,
      result: "通过",
      note: options?.note?.trim() || (currentNodeName ? `${currentNodeName} 审批完成` : "审批节点完成"),
      actedAt: nowStamp(),
    });
    const nextNode = currentIndex >= 0 && flow ? flow.nodes[currentIndex + 1] : null;
    if (nextNode) {
      request.currentApprovalNode = nextNode.name;
      request.currentHandler = resolveHandlerLabel(nextNode);
      request.ccUsers = nextNode.ccList;
    } else {
      request.status = "approved_waiting_payment";
      request.currentApprovalNode = null;
      request.currentHandler = "财务";
      request.ccUsers = [];
      await ensureApprovedRequestLedgerEntryAsync(state, request, {
        actor: "系统",
        note: "审批通过后系统已按组织科目自动入账"
      });
    }
  }

  if (action === "reject" && ["processing", "ocr_pending", "ocr_exception_pending_confirm"].includes(request.status)) {
    const rejectedNode = request.currentApprovalNode;
    request.status = "rejected";
    request.currentApprovalNode = null;
    request.currentHandler = request.applicantName;
    request.ccUsers = [];
    request.approvalHistory.unshift({
      id: nextHistoryId(request.approvalHistory.length + 1),
      action: "审批驳回",
      node: rejectedNode,
      actor: options?.actor?.trim() || request.currentHandler || "审批人",
      result: "驳回",
      note: options?.note?.trim() || "退回申请人修改后重新提交",
      actedAt: nowStamp(),
    });
  }

  if (action === "cancel" && ["draft", "submitted", "ocr_pending", "ocr_exception_pending_confirm", "processing", "approved_waiting_payment"].includes(request.status)) {
    request.status = "cancelled";
    request.currentApprovalNode = null;
    request.currentHandler = null;
    request.ccUsers = [];
    request.approvalHistory.unshift({
      id: nextHistoryId(request.approvalHistory.length + 1),
      action: "申请取消",
      node: null,
      actor: options?.actor?.trim() || request.applicantName,
      result: "已取消",
      note: options?.note?.trim() || "申请人主动取消",
      actedAt: nowStamp(),
    });
  }

  if (action === "return_to_draft" && request.status === "rejected") {
    request.status = "draft";
    request.currentApprovalNode = null;
    request.currentHandler = request.applicantName;
    request.ccUsers = [];
    request.approvalHistory.unshift({
      id: nextHistoryId(request.approvalHistory.length + 1),
      action: "退回修改",
      node: null,
      actor: options?.actor?.trim() || request.applicantName,
      result: "已转草稿",
      note: options?.note?.trim() || "申请人可编辑并重新提交",
      actedAt: nowStamp(),
    });
  }

  await writeRuntimeState(state);
  return request;
}

export async function addPaymentExecution(input: {
  requestId: string;
  bankAccountName: string;
  amount: number;
  executedAt: string;
  bankReference: string;
  voucherFiles: string[];
  note: string;
  executorName: string;
}) {
  const state = await readRuntimeState();
  const request = state.paymentRequests.find((item) => item.id === input.requestId);
  if (!request) {
    throw new Error("request not found");
  }

  const nextPaidAmount = request.paidAmount + input.amount;
  if (nextPaidAmount > request.amount) {
    throw new Error("payment exceeds request amount");
  }

  state.paymentExecutions.unshift({
    id: `PE-${String(state.paymentExecutions.length + 1).padStart(3, "0")}`,
    paymentRequestId: request.id,
    bankAccountName: input.bankAccountName,
    amount: input.amount,
    currency: request.currency,
    executedAt: input.executedAt,
    bankReference: input.bankReference,
    voucherFiles: input.voucherFiles,
    note: input.note,
    executorName: input.executorName,
    verificationStatus: "pending",
    verificationNote: "",
    verifiedBy: null,
    verifiedAt: null
  });

  request.paidAmount = nextPaidAmount;
  request.status = nextPaidAmount === request.amount ? "paid" : "partially_paid";
  request.currentHandler = nextPaidAmount === request.amount ? "财务核对" : "财务";
  request.approvalHistory.unshift({
    id: nextHistoryId(request.approvalHistory.length + 1),
    action: "财务执行",
    node: null,
    actor: input.executorName,
    result: nextPaidAmount === request.amount ? "已付款" : "部分付款",
    note: input.note,
    actedAt: nowStamp(),
  });

  await writeRuntimeState(state);
  return request;
}

export async function updatePaymentExecutionVerification(input: {
  executionId: string;
  action: "verify" | "flag_exception";
  actor: string;
  note: string;
}) {
  const state = await readRuntimeState();
  const execution = state.paymentExecutions.find((item) => item.id === input.executionId);
  if (!execution) {
    throw new Error("execution not found");
  }
  const request = state.paymentRequests.find((item) => item.id === execution.paymentRequestId);
  if (!request) {
    throw new Error("request not found");
  }

  execution.verificationStatus = input.action === "verify" ? "verified" : "exception";
  execution.verificationNote = input.note.trim();
  execution.verifiedBy = input.actor;
  execution.verifiedAt = nowStamp();

  const requestExecutions = state.paymentExecutions.filter((item) => item.paymentRequestId === request.id);
  const hasException = requestExecutions.some((item) => item.verificationStatus === "exception");
  const allVerified = requestExecutions.length > 0 && requestExecutions.every((item) => item.verificationStatus === "verified");

  request.currentHandler = hasException ? "财务复核" : allVerified ? "闭环完成" : "财务核对";
  request.approvalHistory.unshift({
    id: nextHistoryId(request.approvalHistory.length + 1),
    action: input.action === "verify" ? "财务核对通过" : "财务核对异常",
    node: null,
    actor: input.actor,
    result: input.action === "verify" ? "执行已核对" : "执行异常待处理",
    note: input.note.trim() || (input.action === "verify" ? "付款执行与申请信息核对一致。" : "付款执行与申请信息存在差异，待复核。"),
    actedAt: nowStamp(),
  });

  await writeRuntimeState(state);
  return execution;
}

export async function getReportsSnapshot(filters: ReportFilters = {}) {
  const [metrics, ledgerEntries, ledgerSummary, organizations] = await Promise.all([
    getDashboardMetrics(),
    getAllLedgerEntries(),
    getLedgerSummary(filters),
    getOrganizationConfigViewAsync()
  ]);
  const activeOrganizationNames = new Set(organizations.filter((item) => item.isActive).map((item) => item.displayName));
  const scopedLedgerEntries = ledgerEntries.filter((entry) => matchesReportFilters(entry, filters));
  const profit = -scopedLedgerEntries.reduce((sum, entry) => sum + entry.functionalAmount, 0);
  const scopedRequests = (await getPaymentRequests()).filter(
    (entry) =>
      activeOrganizationNames.has(entry.organization) &&
      (!filters.organization || filters.organization === "all" || entry.organization === filters.organization) &&
      (!filters.month || entry.requestedAt.startsWith(filters.month))
  );
  const requestedTotal = scopedRequests.reduce((sum, entry) => sum + entry.amount, 0);
  const paidTotal = scopedRequests.reduce((sum, entry) => sum + entry.paidAmount, 0);
  return {
    metrics,
    profit,
    ledgerCount: ledgerEntries.length,
    ledgerSummary,
    requestedTotal,
    paidTotal
  };
}

export function getOrganizationConfigView() {
  const state = readConfigRuntimeState();
  return withOrganizationDerivedCounts(state.organizations, state.departments, state.projects);
}

export async function getOrganizationConfigViewAsync() {
  const state = await readConfigState();
  return withOrganizationDerivedCounts(state.organizations, state.departments, state.projects);
}

export function getOrganizationByName(name: string) {
  return getOrganizationConfigView().find((item) => item.displayName === name) ?? null;
}

export async function getOrganizationByNameAsync(name: string) {
  return (await getOrganizationConfigViewAsync()).find((item) => item.displayName === name) ?? null;
}

export function getOrganizationSummary() {
  return getOrganizationMetrics(getOrganizationConfigView());
}

export async function getOrganizationSummaryAsync() {
  return getOrganizationMetrics(await getOrganizationConfigViewAsync());
}

export function getDepartmentConfigView() {
  return readConfigRuntimeState().departments;
}

export async function getDepartmentConfigViewAsync() {
  return (await readConfigState()).departments;
}

export function getPersonConfigView() {
  return readConfigRuntimeState().persons;
}

export async function getPersonConfigViewAsync() {
  return (await readConfigState()).persons;
}

export function getProjectConfigView() {
  return readConfigRuntimeState().projects;
}

export async function getProjectConfigViewAsync() {
  return (await readConfigState()).projects;
}

export async function getMasterDataSummaryAsync() {
  const [organizations, departments, persons, projects] = await Promise.all([
    getOrganizationConfigViewAsync(),
    getDepartmentConfigViewAsync(),
    getPersonConfigViewAsync(),
    getProjectConfigViewAsync()
  ]);
  return {
    organizations: organizations.filter((item) => item.isActive).length,
    departments: departments.filter((item) => item.isActive).length,
    persons: persons.filter((item) => item.isActive).length,
    projects: projects.filter((item) => item.isActive).length
  };
}

export async function getProjectsForOrganizationAsync(organization: string) {
  return (await getProjectConfigViewAsync()).filter((item) => item.isActive && item.organization === organization);
}

export function getOcrRuleConfigView() {
  return readConfigRuntimeState().ocrRules;
}

export async function getOcrRuleConfigViewAsync() {
  return (await readConfigState()).ocrRules;
}

export async function getOcrRuleSummaryAsync() {
  const rules = await getOcrRuleConfigViewAsync();
  return {
    totalRules: rules.length,
    enabledRules: rules.filter((item) => item.enabled).length,
    blockingRules: rules.filter((item) => item.enabled && item.blockOnMismatch).length,
    coveredOrganizations: new Set(rules.flatMap((item) => item.organizationScope)).size
  };
}

export async function getOcrWorkbenchRowsAsync(filter: {
  organization?: string;
  mode?: "all" | "pending" | "exception" | "confirmed";
} = {}) {
  const requests = await getPaymentRequests();
  return requests
    .filter((request) => {
      if (filter.organization && filter.organization !== "all" && request.organization !== filter.organization) {
        return false;
      }
      if (filter.mode === "pending") {
        return request.status === "ocr_pending";
      }
      if (filter.mode === "exception") {
        return request.status === "ocr_exception_pending_confirm";
      }
      if (filter.mode === "confirmed") {
        return request.ocrStatus === "confirmed_exception" || request.ocrStatus === "matched";
      }
      return ["ocr_pending", "ocr_exception_pending_confirm", "processing", "approved_waiting_payment", "partially_paid", "paid"].includes(request.status);
    })
    .map((request) => ({
      id: request.id,
      title: request.title,
      organization: request.organization,
      applicantName: request.applicantName,
      amount: request.amount,
      currency: request.currency,
      ocrStatus: request.ocrStatus,
      requestStatus: request.status,
      documentType: request.ocrResult?.documentType ?? getOcrCandidateDocumentType(request),
      matchedCount: request.ocrResult?.matchedFields.length ?? 0,
      mismatchedCount: request.ocrResult?.mismatchedFields.length ?? 0,
      note: request.ocrResult?.note ?? "等待 OCR 识别",
      currentHandler: request.currentHandler ?? "-"
    }));
}

export function getApprovalFlowTemplatesView() {
  return readConfigRuntimeState().approvalFlowTemplates;
}

export async function getApprovalFlowTemplatesViewAsync() {
  return (await readConfigState()).approvalFlowTemplates;
}

export function getApprovalFlowSummary() {
  return getFlowTemplateMetrics(getApprovalFlowTemplatesView());
}

export async function getApprovalFlowSummaryAsync() {
  return getFlowTemplateMetrics(await getApprovalFlowTemplatesViewAsync());
}

export async function getOrganizationReportRows(filters: ReportFilters = {}) {
  const [paymentRequests, ledgerEntries, organizations, executions, state] = await Promise.all([
    getPaymentRequests(),
    getAllLedgerEntries(),
    getOrganizationConfigViewAsync(),
    readRuntimeState().then((item) => item.paymentExecutions),
    readRuntimeState()
  ]);
  return organizations
    .filter(
      (organization) =>
        organization.isActive &&
        organization.includeInGroupReport &&
        (!filters.organization || filters.organization === "all" || organization.displayName === filters.organization)
    )
    .map((organization) => {
      const requestRows = paymentRequests.filter(
        (item) =>
          item.organization === organization.displayName &&
          (!filters.month || item.requestedAt.startsWith(filters.month))
      );
      const ledgerRows = ledgerEntries.filter(
        (item) =>
          item.organization === organization.displayName &&
          (!filters.month || item.businessDate.startsWith(filters.month))
      );
      const requestIds = new Set(requestRows.map((item) => item.id));
      const executionRows = executions.filter((item) => requestIds.has(item.paymentRequestId));
      return {
        id: organization.id,
        organization: organization.displayName,
        taxLabel: organization.taxLabel,
        baseCurrency: organization.baseCurrency,
        settlementRole: organization.settlementRole,
        requestCount: requestRows.length,
        requestedTotal: requestRows.reduce((sum, item) => sum + item.amount, 0),
        paidTotal: requestRows.reduce((sum, item) => sum + item.paidAmount, 0),
        outflowTotal: ledgerRows.reduce((sum, item) => sum + item.functionalAmount, 0),
        autoPostedCount: requestRows.filter((item) => isAutoPostedRequest(state, item)).length,
        executionExceptionCount: executionRows.filter((item) => item.verificationStatus === "exception").length
      };
    });
}

export async function getRoleDashboardView(role: "boss" | "finance" | "cashier" | "applicant") {
  const [metrics, state, organizationConfig, bankRows] = await Promise.all([
    getDashboardMetrics(),
    readRuntimeState(),
    getOrganizationConfigViewAsync(),
    getBankAccountReportRowsAsync()
  ]);
  const paymentRequests = state.paymentRequests;
  const paymentExecutions = state.paymentExecutions;
  const autoPostedRequests = paymentRequests.filter((item) => isAutoPostedRequest(state, item));
  const paidReviewRequests = paymentExecutions.filter((item) => item.verificationStatus === "pending");
  const executionExceptions = paymentExecutions.filter((item) => item.verificationStatus === "exception");

  if (role === "boss") {
    const defaultAccountCoverage = bankRows.filter((item) => item.defaultAccountName !== "未设置默认").length;
    return {
      title: "集团经营概览",
      description: "看集团总资金、组织支出、自动入账结果和经营报表。",
      stats: [
        { label: "集团总资金余额", value: formatMoney(metrics.totalFunds, "RUB"), note: "集团视角" },
        { label: "已自动入账单据", value: String(autoPostedRequests.length), note: "审批通过后已入总账" },
        { label: "已付款待核对", value: String(paidReviewRequests.length), note: "付款执行待财务核对" },
        { label: "纳入汇总组织", value: String(organizationConfig.filter((item) => item.includeInGroupReport).length), note: "老板可看" },
        { label: "执行异常", value: String(executionExceptions.length), note: "付款执行需复核" }
      ]
    };
  }

  if (role === "finance") {
    return {
      title: "财务结算概览",
      description: "盯付款申请、待付款、自动入账沉淀和财务结果一致性。",
      stats: [
        { label: "待审批单据", value: String(metrics.pendingApprovals), note: "待继续处理" },
        {
          label: "待付款金额",
          value: formatMoney(
            paymentRequests
              .filter((item) => item.status === "approved_waiting_payment" || item.status === "partially_paid")
              .reduce((sum, item) => sum + (item.amount - item.paidAmount), 0),
            "RUB"
          ),
          note: "待执行"
        },
        {
          label: "已自动入账",
          value: String(autoPostedRequests.length),
          note: "审批自动入总账"
        },
        {
          label: "已付款待核对",
          value: String(paidReviewRequests.length),
          note: "待核对执行结果"
        },
        {
          label: "执行异常",
          value: String(executionExceptions.length),
          note: "待复核"
        }
      ]
    };
  }

  if (role === "cashier") {
    return {
      title: "出纳执行概览",
      description: "盯 OCR 异常、付款执行和申请金额是否对得上。",
      stats: [
        { label: "OCR异常", value: String(metrics.ocrExceptions), note: "待确认" },
        {
          label: "总付款金额",
          value: formatMoney(state.paymentExecutions.reduce((sum, item) => sum + item.amount, 0), "RUB"),
          note: "执行累计"
        },
        {
          label: "待核对申请",
          value: String(paymentRequests.filter((item) => item.status === "ocr_pending" || item.status === "ocr_exception_pending_confirm").length),
          note: "OCR相关"
        },
        {
          label: "未付余额",
          value: formatMoney(paymentRequests.reduce((sum, item) => sum + (item.amount - item.paidAmount), 0), "RUB"),
          note: "申请与付款对比"
        }
      ]
    };
  }

  const applicantName = "王珊";
  const ownRequests = paymentRequests.filter((item) => item.applicantName === applicantName);
  return {
    title: "我的申请概览",
    description: "只看自己的申请、进度、待付款和系统自动入账情况。",
    stats: [
      { label: "我的申请", value: String(ownRequests.length), note: applicantName },
      {
        label: "待处理",
        value: String(ownRequests.filter((item) => ["submitted", "ocr_pending", "processing"].includes(item.status)).length),
        note: "处理中"
      },
      {
        label: "待付款",
        value: String(ownRequests.filter((item) => item.status === "approved_waiting_payment").length),
        note: "已通过审批"
      },
      {
        label: "执行中",
        value: String(ownRequests.filter((item) => item.status === "partially_paid" || item.status === "paid").length),
        note: "财务正在执行或核对"
      },
      {
        label: "已自动入账",
        value: String(ownRequests.filter((item) => isAutoPostedRequest(state, item)).length),
        note: "审批通过后系统自动入账"
      }
    ]
  };
}

export function getPaymentFormTemplateView() {
  return readConfigRuntimeState().paymentRequestFormTemplate;
}

export async function getPaymentFormTemplateViewAsync() {
  return (await readConfigState()).paymentRequestFormTemplate;
}

export function getPaymentFormTemplateSummary() {
  return getPaymentFormTemplateMetrics(getPaymentFormTemplateView());
}

export async function getPaymentFormTemplateSummaryAsync() {
  return getPaymentFormTemplateMetrics(await getPaymentFormTemplateViewAsync());
}

export function getBankAccountConfigView() {
  return readConfigRuntimeState().bankAccounts;
}

export async function getBankAccountConfigViewAsync() {
  return (await readConfigState()).bankAccounts;
}

export function getBankAccountSummary() {
  return getBankAccountMetrics(getBankAccountConfigView());
}

export async function getBankAccountSummaryAsync() {
  return getBankAccountMetrics(await getBankAccountConfigViewAsync());
}

export function getBankAccountReportRows() {
  const groupedOrganizations = new Set(
    getOrganizationConfigView()
      .filter((item) => item.isActive && item.includeInGroupReport)
      .map((item) => item.displayName)
  );

  return getBankAccountConfigView()
    .filter((account) => account.isActive && groupedOrganizations.has(account.organization))
    .reduce<
      Array<{
        id: string;
        organization: string;
        currency: "RUB" | "CNY" | "USD";
        activeAccountCount: number;
        totalBalance: number;
        defaultAccountName: string;
        defaultBankName: string;
      }>
    >((rows, account) => {
      const existing = rows.find(
        (row) => row.organization === account.organization && row.currency === account.currency
      );
      if (existing) {
        existing.activeAccountCount += 1;
        existing.totalBalance += account.balance;
        if (account.isDefault) {
          existing.defaultAccountName = account.accountName;
          existing.defaultBankName = account.bankName;
        }
        return rows;
      }

      rows.push({
        id: `${account.organization}-${account.currency}`,
        organization: account.organization,
        currency: account.currency,
        activeAccountCount: 1,
        totalBalance: account.balance,
        defaultAccountName: account.isDefault ? account.accountName : "未设置默认",
        defaultBankName: account.isDefault ? account.bankName : "-"
      });
      return rows;
    }, [])
    .sort((a, b) => a.organization.localeCompare(b.organization, "zh-CN") || a.currency.localeCompare(b.currency));
}

export async function getBankAccountReportRowsAsync() {
  const organizations = await getOrganizationConfigViewAsync();
  const bankAccounts = await getBankAccountConfigViewAsync();
  const groupedOrganizations = new Set(
    organizations
      .filter((item) => item.isActive && item.includeInGroupReport)
      .map((item) => item.displayName)
  );

  return bankAccounts
    .filter((account) => account.isActive && groupedOrganizations.has(account.organization))
    .reduce<
      Array<{
        id: string;
        organization: string;
        currency: "RUB" | "CNY" | "USD";
        activeAccountCount: number;
        totalBalance: number;
        defaultAccountName: string;
        defaultBankName: string;
      }>
    >((rows, account) => {
      const existing = rows.find(
        (row) => row.organization === account.organization && row.currency === account.currency
      );
      if (existing) {
        existing.activeAccountCount += 1;
        existing.totalBalance += account.balance;
        if (account.isDefault) {
          existing.defaultAccountName = account.accountName;
          existing.defaultBankName = account.bankName;
        }
        return rows;
      }

      rows.push({
        id: `${account.organization}-${account.currency}`,
        organization: account.organization,
        currency: account.currency,
        activeAccountCount: 1,
        totalBalance: account.balance,
        defaultAccountName: account.isDefault ? account.accountName : "未设置默认",
        defaultBankName: account.isDefault ? account.bankName : "-"
      });
      return rows;
    }, [])
    .sort((a, b) => a.organization.localeCompare(b.organization, "zh-CN") || a.currency.localeCompare(b.currency));
}

export function getBankAccountsForOrganizationCurrency(
  organization: string,
  currency?: "RUB" | "CNY" | "USD"
) {
  const activeAccounts = getBankAccountConfigView().filter((item) => item.isActive && item.organization === organization);
  if (!currency) {
    return activeAccounts;
  }
  const exactMatches = activeAccounts.filter((item) => item.currency === currency);
  return exactMatches.length > 0 ? exactMatches : activeAccounts;
}

export function getDefaultBankAccountForOrganizationCurrency(
  organization: string,
  currency?: "RUB" | "CNY" | "USD"
) {
  const availableAccounts = getBankAccountsForOrganizationCurrency(organization, currency);
  return (
    availableAccounts.find((item) => item.isDefault && (!currency || item.currency === currency)) ??
    availableAccounts.find((item) => !currency || item.currency === currency) ??
    availableAccounts[0] ??
    null
  );
}

export async function getDefaultBankAccountForOrganizationCurrencyAsync(
  organization: string,
  currency?: "RUB" | "CNY" | "USD"
) {
  const bankAccounts = await getBankAccountConfigViewAsync();
  const activeAccounts = bankAccounts.filter((item) => item.isActive && item.organization === organization);
  const availableAccounts = !currency
    ? activeAccounts
    : (() => {
        const exactMatches = activeAccounts.filter((item) => item.currency === currency);
        return exactMatches.length > 0 ? exactMatches : activeAccounts;
      })();
  return (
    availableAccounts.find((item) => item.isDefault && (!currency || item.currency === currency)) ??
    availableAccounts.find((item) => !currency || item.currency === currency) ??
    availableAccounts[0] ??
    null
  );
}

export function getPaymentPartyConfigView() {
  return readConfigRuntimeState().paymentParties;
}

export async function getPaymentPartyConfigViewAsync() {
  return (await readConfigState()).paymentParties;
}

export function getPaymentPartySummary() {
  return getPaymentPartyMetrics(getPaymentPartyConfigView());
}

export async function getPaymentPartySummaryAsync() {
  return getPaymentPartyMetrics(await getPaymentPartyConfigViewAsync());
}

export function getRoleConfigView() {
  return readConfigRuntimeState().roleConfigs;
}

export async function getRoleConfigViewAsync() {
  return (await readConfigState()).roleConfigs;
}

export function getUserAccountView() {
  return readConfigRuntimeState().userAccounts;
}

export async function getUserAccountViewAsync() {
  return (await readConfigState()).userAccounts;
}

export async function getAccessSummaryAsync() {
  const [roles, users] = await Promise.all([getRoleConfigViewAsync(), getUserAccountViewAsync()]);
  return {
    totalRoles: roles.length,
    totalUsers: users.length,
    activeUsers: users.filter((item) => item.isActive).length,
    configurableRoles: roles.filter((item) => item.configPermissions.access).length
  };
}

export async function createUserAccountConfig(input: {
  username: string;
  password: string;
  displayName: string;
  role: UserAccountRecord["role"];
  organizationScope: string[];
}) {
  const state = await readConfigState();
  const nextId = `user-${String(state.userAccounts.length + 1).padStart(3, "0")}`;
  state.userAccounts.unshift({
    id: nextId,
    username: input.username,
    password: input.password,
    displayName: input.displayName,
    role: input.role,
    organizationScope: input.organizationScope,
    isActive: true
  });
  await writeConfigRuntimeState(state);
}

export async function toggleUserAccountConfig(userId: string) {
  const state = await readConfigState();
  state.userAccounts = state.userAccounts.map((item) =>
    item.id === userId ? { ...item, isActive: !item.isActive } : item
  );
  await writeConfigRuntimeState(state);
}

export async function updateUserAccountRoleConfig(userId: string, role: UserAccountRecord["role"]) {
  const state = await readConfigState();
  state.userAccounts = state.userAccounts.map((item) =>
    item.id === userId ? { ...item, role } : item
  );
  await writeConfigRuntimeState(state);
}

export async function resetUserAccountPasswordConfig(userId: string, password: string) {
  const state = await readConfigState();
  state.userAccounts = state.userAccounts.map((item) =>
    item.id === userId ? { ...item, password } : item
  );
  await writeConfigRuntimeState(state);
}

export async function toggleUserOrganizationScopeConfig(userId: string, organizationName: string) {
  const state = await readConfigState();
  state.userAccounts = state.userAccounts.map((item) => {
    if (item.id !== userId) {
      return item;
    }
    const current = new Set(item.organizationScope);
    if (current.has(organizationName)) {
      current.delete(organizationName);
    } else {
      current.add(organizationName);
    }
    return { ...item, organizationScope: Array.from(current) };
  });
  await writeConfigRuntimeState(state);
}

export async function updateRoleDescriptionConfig(roleId: RoleConfigRecord["id"], description: string) {
  const state = await readConfigState();
  state.roleConfigs = state.roleConfigs.map((item) =>
    item.id === roleId ? { ...item, description } : item
  );
  await writeConfigRuntimeState(state);
}

export async function updateRoleDataScopeConfig(
  roleId: RoleConfigRecord["id"],
  dataScope: RoleConfigRecord["dataScope"]
) {
  const state = await readConfigState();
  state.roleConfigs = state.roleConfigs.map((item) =>
    item.id === roleId ? { ...item, dataScope } : item
  );
  await writeConfigRuntimeState(state);
}

export async function toggleRolePageAccessConfig(
  roleId: RoleConfigRecord["id"],
  pageAccess: RoleConfigRecord["pageAccess"][number]
) {
  const state = await readConfigState();
  state.roleConfigs = state.roleConfigs.map((item) => {
    if (item.id !== roleId) {
      return item;
    }
    const current = new Set(item.pageAccess);
    if (current.has(pageAccess)) {
      current.delete(pageAccess);
    } else {
      current.add(pageAccess);
    }
    return { ...item, pageAccess: Array.from(current) as RoleConfigRecord["pageAccess"] };
  });
  await writeConfigRuntimeState(state);
}

export async function toggleRoleConfigPermissionConfig(
  roleId: RoleConfigRecord["id"],
  permissionKey: keyof RoleConfigRecord["configPermissions"]
) {
  const state = await readConfigState();
  state.roleConfigs = state.roleConfigs.map((item) =>
    item.id === roleId
      ? {
          ...item,
          configPermissions: {
            ...item.configPermissions,
            [permissionKey]: !item.configPermissions[permissionKey]
          }
        }
      : item
  );
  await writeConfigRuntimeState(state);
}

export async function toggleRoleApprovalPermissionConfig(
  roleId: RoleConfigRecord["id"],
  permissionKey: keyof RoleConfigRecord["approvalPermissions"]
) {
  const state = await readConfigState();
  state.roleConfigs = state.roleConfigs.map((item) =>
    item.id === roleId
      ? {
          ...item,
          approvalPermissions: {
            ...item.approvalPermissions,
            [permissionKey]: !item.approvalPermissions[permissionKey]
          }
        }
      : item
  );
  await writeConfigRuntimeState(state);
}

export async function createDepartmentConfig(input: {
  name: string;
  organization: string;
  parentDepartmentId: string | null;
  managerPersonId: string | null;
}) {
  const state = await readConfigState();
  const nextId = `dept-${String(state.departments.length + 1).padStart(3, "0")}`;
  state.departments.unshift({
    id: nextId,
    name: input.name,
    organization: input.organization,
    parentDepartmentId: input.parentDepartmentId,
    managerPersonId: input.managerPersonId,
    isActive: true
  });
  await writeConfigRuntimeState(state);
}

export async function toggleDepartmentConfig(departmentId: string) {
  const state = await readConfigState();
  state.departments = state.departments.map((item) =>
    item.id === departmentId ? { ...item, isActive: !item.isActive } : item
  );
  await writeConfigRuntimeState(state);
}

export async function createProjectConfig(input: {
  name: string;
  organization: string;
  type: ProjectConfigRecord["type"];
  code: string;
  managerPersonId: string | null;
}) {
  const state = await readConfigState();
  const nextId = `project-${String(state.projects.length + 1).padStart(3, "0")}`;
  state.projects.unshift({
    id: nextId,
    name: input.name,
    organization: input.organization,
    type: input.type,
    code: input.code,
    managerPersonId: input.managerPersonId,
    isActive: true
  });
  await writeConfigRuntimeState(state);
}

export async function toggleProjectConfig(projectId: string) {
  const state = await readConfigState();
  state.projects = state.projects.map((item) =>
    item.id === projectId ? { ...item, isActive: !item.isActive } : item
  );
  await writeConfigRuntimeState(state);
}

export async function createPersonConfig(input: {
  displayName: string;
  organization: string;
  departmentId: string | null;
  title: string;
  managerPersonId: string | null;
  phone: string;
  email: string;
}) {
  const state = await readConfigState();
  const nextId = `person-${String(state.persons.length + 1).padStart(3, "0")}`;
  state.persons.unshift({
    id: nextId,
    displayName: input.displayName,
    organization: input.organization,
    departmentId: input.departmentId,
    title: input.title,
    managerPersonId: input.managerPersonId,
    phone: input.phone,
    email: input.email,
    isActive: true
  });
  await writeConfigRuntimeState(state);
}

export async function togglePersonConfig(personId: string) {
  const state = await readConfigState();
  state.persons = state.persons.map((item) =>
    item.id === personId ? { ...item, isActive: !item.isActive } : item
  );
  await writeConfigRuntimeState(state);
}

export async function createOrganizationConfig(input: {
  displayName: string;
  legalNameRu: string;
  legalForm: "OOO" | "IP" | "AO" | "OTHER";
  taxMode: "VAT" | "USN" | "OTHER";
  taxLabel: string;
  baseCurrency: "RUB" | "CNY" | "USD";
  enableMultiCurrency: boolean;
  enableExchangeRate: boolean;
  allowedCurrencies: Array<"RUB" | "CNY" | "USD">;
  includeInGroupReport: boolean;
  settlementRole: "operating" | "import" | "brand" | "franchise" | "other";
}) {
  const state = await readConfigState();
  const nextId = `org-${String(state.organizations.length + 1).padStart(3, "0")}`;
  state.organizations.unshift({
    id: nextId,
    displayName: input.displayName,
    legalNameRu: input.legalNameRu,
    legalForm: input.legalForm,
    taxMode: input.taxMode,
    taxLabel: input.taxLabel,
    baseCurrency: input.baseCurrency,
    enableMultiCurrency: input.enableMultiCurrency,
    enableExchangeRate: input.enableExchangeRate,
    allowedCurrencies: input.allowedCurrencies,
    bankAccountCount: 0,
    projectCount: 0,
    departmentCount: 0,
    isActive: true,
    includeInGroupReport: input.includeInGroupReport,
    settlementRole: input.settlementRole
  });
  await writeConfigRuntimeState(state);
}

export async function toggleOrganizationConfig(organizationId: string) {
  const state = await readConfigState();
  state.organizations = state.organizations.map((item) =>
    item.id === organizationId ? { ...item, isActive: !item.isActive } : item
  );
  await writeConfigRuntimeState(state);
}

export async function toggleOrganizationGroupReporting(organizationId: string) {
  const state = await readConfigState();
  state.organizations = state.organizations.map((item) =>
    item.id === organizationId ? { ...item, includeInGroupReport: !item.includeInGroupReport } : item
  );
  await writeConfigRuntimeState(state);
}

export async function createOcrRuleConfig(input: {
  name: string;
  documentType: OcrRuleConfigRecord["documentType"];
  organizationScope: string[];
  requiredFields: OcrRuleConfigRecord["requiredFields"];
  blockOnMismatch: boolean;
}) {
  const state = await readConfigState();
  const nextId = `ocr-${String(state.ocrRules.length + 1).padStart(3, "0")}`;
  state.ocrRules.unshift({
    id: nextId,
    name: input.name,
    documentType: input.documentType,
    organizationScope: input.organizationScope,
    requiredFields: input.requiredFields,
    blockOnMismatch: input.blockOnMismatch,
    enabled: true
  });
  await writeConfigRuntimeState(state);
}

export async function toggleOcrRuleConfig(ruleId: string) {
  const state = await readConfigState();
  state.ocrRules = state.ocrRules.map((item) => (item.id === ruleId ? { ...item, enabled: !item.enabled } : item));
  await writeConfigRuntimeState(state);
}

export async function toggleOcrRuleOrganizationScope(ruleId: string, organizationName: string) {
  const state = await readConfigState();
  state.ocrRules = state.ocrRules.map((item) => {
    if (item.id !== ruleId) return item;
    const exists = item.organizationScope.includes(organizationName);
    return {
      ...item,
      organizationScope: exists
        ? item.organizationScope.filter((name) => name !== organizationName)
        : [...item.organizationScope, organizationName]
    };
  });
  await writeConfigRuntimeState(state);
}

export async function createBankAccountConfig(input: {
  organization: string;
  accountName: string;
  bankName: string;
  accountNumber: string;
  currency: "RUB" | "CNY" | "USD";
  balance: number;
  isDefault: boolean;
}) {
  const state = await readConfigState();
  const nextId = `ba-${String(state.bankAccounts.length + 1).padStart(3, "0")}`;
  if (input.isDefault) {
    state.bankAccounts = state.bankAccounts.map((item) =>
      item.organization === input.organization && item.currency === input.currency ? { ...item, isDefault: false } : item
    );
  }
  state.bankAccounts.unshift({
    id: nextId,
    organization: input.organization,
    accountName: input.accountName,
    bankName: input.bankName,
    accountNumber: input.accountNumber,
    currency: input.currency,
    balance: input.balance,
    isDefault: input.isDefault,
    isActive: true
  });
  await writeConfigRuntimeState(state);
}

export async function toggleBankAccountConfig(accountId: string) {
  const state = await readConfigState();
  state.bankAccounts = state.bankAccounts.map((item) =>
    item.id === accountId ? { ...item, isActive: !item.isActive } : item
  );
  await writeConfigRuntimeState(state);
}

export async function setDefaultBankAccountConfig(accountId: string) {
  const state = await readConfigState();
  const target = state.bankAccounts.find((item) => item.id === accountId);
  if (!target) {
    return;
  }
  state.bankAccounts = state.bankAccounts.map((item) =>
    item.organization === target.organization && item.currency === target.currency
      ? { ...item, isDefault: item.id === accountId }
      : item
  );
  await writeConfigRuntimeState(state);
}

export async function createPaymentPartyConfig(input: {
  name: string;
  type: "supplier" | "customer" | "internal" | "person";
  organizationScope: string[];
  bankName: string;
  bankAccount: string;
  contactName: string;
  phone: string;
}) {
  const state = await readConfigState();
  const nextId = `pp-${String(state.paymentParties.length + 1).padStart(3, "0")}`;
  state.paymentParties.unshift({
    id: nextId,
    name: input.name,
    type: input.type,
    organizationScope: input.organizationScope,
    bankName: input.bankName,
    bankAccount: input.bankAccount,
    contactName: input.contactName,
    phone: input.phone,
    isActive: true
  });
  await writeConfigRuntimeState(state);
}

export async function createLedgerAccountMappingConfig(input: {
  organizationScope: string[];
  scenario: LedgerAccountMappingRecord["scenario"];
  accountCode: string;
  accountName: string;
}) {
  const state = await readConfigState();
  const nextId = `lam-${String(state.ledgerAccountMappings.length + 1).padStart(3, "0")}`;
  state.ledgerAccountMappings.unshift({
    id: nextId,
    organizationScope: input.organizationScope,
    scenario: input.scenario,
    accountCode: input.accountCode,
    accountName: input.accountName,
    isActive: true
  });
  await writeConfigRuntimeState(state);
}

export async function toggleLedgerAccountMappingConfig(mappingId: string) {
  const state = await readConfigState();
  state.ledgerAccountMappings = state.ledgerAccountMappings.map((item) =>
    item.id === mappingId ? { ...item, isActive: !item.isActive } : item
  );
  await writeConfigRuntimeState(state);
}

export async function toggleLedgerAccountMappingOrganizationScope(mappingId: string, organizationName: string) {
  const state = await readConfigState();
  state.ledgerAccountMappings = state.ledgerAccountMappings.map((item) => {
    if (item.id !== mappingId) {
      return item;
    }
    const exists = item.organizationScope.includes(organizationName);
    return {
      ...item,
      organizationScope: exists
        ? item.organizationScope.filter((name) => name !== organizationName)
        : [...item.organizationScope, organizationName]
    };
  });
  await writeConfigRuntimeState(state);
}

export async function createExchangeRateConfig(input: {
  organizationScope: string[];
  fromCurrency: "RUB" | "CNY" | "USD";
  toCurrency: "RUB" | "CNY" | "USD";
  rate: number;
  effectiveDate: string;
}) {
  const state = await readConfigState();
  const nextId = `fx-${String(state.exchangeRates.length + 1).padStart(3, "0")}`;
  state.exchangeRates.unshift({
    id: nextId,
    organizationScope: input.organizationScope,
    fromCurrency: input.fromCurrency,
    toCurrency: input.toCurrency,
    rate: input.rate,
    effectiveDate: input.effectiveDate,
    isActive: true
  });
  await writeConfigRuntimeState(state);
}

export async function toggleExchangeRateConfig(rateId: string) {
  const state = await readConfigState();
  state.exchangeRates = state.exchangeRates.map((item) =>
    item.id === rateId ? { ...item, isActive: !item.isActive } : item
  );
  await writeConfigRuntimeState(state);
}

export async function toggleExchangeRateOrganizationScope(rateId: string, organizationName: string) {
  const state = await readConfigState();
  state.exchangeRates = state.exchangeRates.map((item) => {
    if (item.id !== rateId) {
      return item;
    }
    const exists = item.organizationScope.includes(organizationName);
    return {
      ...item,
      organizationScope: exists
        ? item.organizationScope.filter((name) => name !== organizationName)
        : [...item.organizationScope, organizationName]
    };
  });
  await writeConfigRuntimeState(state);
}

export async function togglePaymentPartyConfig(partyId: string) {
  const state = await readConfigState();
  state.paymentParties = state.paymentParties.map((item) =>
    item.id === partyId ? { ...item, isActive: !item.isActive } : item
  );
  await writeConfigRuntimeState(state);
}

export async function togglePaymentPartyOrganizationScope(partyId: string, organizationName: string) {
  const state = await readConfigState();
  state.paymentParties = state.paymentParties.map((item) => {
    if (item.id !== partyId) {
      return item;
    }
    const scope = item.organizationScope ?? [];
    const exists = scope.includes(organizationName);
    return {
      ...item,
      organizationScope: exists ? scope.filter((name) => name !== organizationName) : [...scope, organizationName]
    };
  });
  await writeConfigRuntimeState(state);
}

export async function toggleApprovalFlowTemplate(templateId: string) {
  const state = await readConfigState();
  state.approvalFlowTemplates = state.approvalFlowTemplates.map((item) =>
    item.id === templateId ? { ...item, enabled: !item.enabled } : item
  );
  await writeConfigRuntimeState(state);
}

export async function toggleApprovalFlowOrganizationScope(templateId: string, organizationName: string) {
  const state = await readConfigState();
  state.approvalFlowTemplates = state.approvalFlowTemplates.map((item) => {
    if (item.id !== templateId) {
      return item;
    }
    const exists = item.organizationScope.includes(organizationName);
    return {
      ...item,
      organizationScope: exists
        ? item.organizationScope.filter((name) => name !== organizationName)
        : [...item.organizationScope, organizationName]
    };
  });
  await writeConfigRuntimeState(state);
}

export async function togglePaymentFormFieldEnabled(fieldId: string) {
  const state = await readConfigState();
  state.paymentRequestFormTemplate = {
    ...state.paymentRequestFormTemplate,
    fields: state.paymentRequestFormTemplate.fields.map((field) =>
      field.id === fieldId ? { ...field, enabled: field.enabled === false ? true : false } : field
    )
  };
  await writeConfigRuntimeState(state);
}

export async function togglePaymentFormFieldRequired(fieldId: string) {
  const state = await readConfigState();
  state.paymentRequestFormTemplate = {
    ...state.paymentRequestFormTemplate,
    fields: state.paymentRequestFormTemplate.fields.map((field) =>
      field.id === fieldId ? { ...field, required: !field.required, enabled: field.enabled ?? true } : field
    )
  };
  await writeConfigRuntimeState(state);
}

export async function togglePaymentFormFieldOrganizationScope(fieldId: string, organizationName: string) {
  const state = await readConfigState();
  state.paymentRequestFormTemplate = {
    ...state.paymentRequestFormTemplate,
    fields: state.paymentRequestFormTemplate.fields.map((field) => {
      if (field.id !== fieldId) {
        return field;
      }
      const scope = field.organizationScope ?? [];
      const exists = scope.includes(organizationName);
      return {
        ...field,
        organizationScope: exists ? scope.filter((name) => name !== organizationName) : [...scope, organizationName]
      };
    })
  };
  await writeConfigRuntimeState(state);
}

function selectApprovalFlow(organization: string, isInternal: boolean, currency: PaymentRequestRecord["currency"]) {
  const organizationRecord = getOrganizationByName(organization);
  if (!organizationRecord || !organizationRecord.isActive) {
    return null;
  }
  return (
    getApprovalFlowTemplatesView().find((template) => {
      if (!template.enabled || template.requestType !== "payment") {
        return false;
      }
      if (!template.organizationScope.includes(organization)) {
        return false;
      }
      if (!template.currencyScope.includes(currency)) {
        return false;
      }
      if (isInternal) {
        return template.id === "flow-payment-internal";
      }
      if (organizationRecord.settlementRole === "import") {
        return template.id === "flow-payment-import";
      }
      return template.id === "flow-payment-standard";
    }) ?? null
  );
}

async function selectApprovalFlowAsync(organization: string, isInternal: boolean, currency: PaymentRequestRecord["currency"]) {
  const organizationRecord = await getOrganizationByNameAsync(organization);
  if (!organizationRecord || !organizationRecord.isActive) {
    return null;
  }
  const templates = await getApprovalFlowTemplatesViewAsync();
  return (
    templates.find((template) => {
      if (!template.enabled || template.requestType !== "payment") {
        return false;
      }
      if (!template.organizationScope.includes(organization)) {
        return false;
      }
      if (!template.currencyScope.includes(currency)) {
        return false;
      }
      if (isInternal) {
        return template.id === "flow-payment-internal";
      }
      if (organizationRecord.settlementRole === "import") {
        return template.id === "flow-payment-import";
      }
      return template.id === "flow-payment-standard";
    }) ?? null
  );
}

function resolveHandlerLabel(node: { approverType: string; approverValue: string } | null) {
  if (!node) {
    return null;
  }
  if (node.approverType === "manager") {
    return "发起人上级";
  }
  return node.approverValue;
}

function matchesRoleFilter(request: PaymentRequestRecord, role: PaymentRoleFilter) {
  if (role === "boss") {
    return true;
  }
  if (role === "finance") {
    return ["processing", "approved_waiting_payment", "partially_paid", "paid"].includes(request.status);
  }
  if (role === "cashier") {
    return ["ocr_pending", "ocr_exception_pending_confirm", "approved_waiting_payment", "partially_paid", "paid"].includes(request.status);
  }
  return request.applicantName === "王珊";
}

function nowStamp() {
  return new Date().toISOString().slice(0, 16).replace("T", " ");
}

function nextHistoryId(sequence: number) {
  return `AH-${String(sequence).padStart(4, "0")}`;
}

export { formatMoney, getStatusTone, ocrStatusLabels, paymentStatusLabels };
