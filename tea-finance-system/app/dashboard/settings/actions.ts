"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { canManageConfig, requirePageAccess } from "@/lib/auth";
import {
  createDepartmentConfig,
  createBankAccountConfig,
  createExchangeRateConfig,
  createLedgerAccountMappingConfig,
  createOcrRuleConfig,
  createOrganizationConfig,
  createPaymentPartyConfig,
  createPersonConfig,
  createProjectConfig,
  createUserAccountConfig,
  getRoleConfigViewAsync,
  resetUserAccountPasswordConfig,
  setDefaultBankAccountConfig,
  toggleApprovalFlowOrganizationScope,
  toggleApprovalFlowTemplate,
  toggleBankAccountConfig,
  toggleExchangeRateConfig,
  toggleExchangeRateOrganizationScope,
  toggleLedgerAccountMappingConfig,
  toggleLedgerAccountMappingOrganizationScope,
  toggleOcrRuleConfig,
  toggleOcrRuleOrganizationScope,
  togglePaymentPartyOrganizationScope,
  togglePaymentFormFieldOrganizationScope,
  togglePaymentFormFieldEnabled,
  togglePaymentFormFieldRequired,
  togglePersonConfig,
  toggleProjectConfig,
  toggleRoleApprovalPermissionConfig,
  toggleRoleConfigPermissionConfig,
  toggleRolePageAccessConfig,
  toggleOrganizationConfig,
  toggleOrganizationGroupReporting,
  togglePaymentPartyConfig,
  toggleDepartmentConfig,
  toggleUserOrganizationScopeConfig,
  toggleUserAccountConfig
  ,
  updateRoleDataScopeConfig,
  updateRoleDescriptionConfig,
  updateUserAccountRoleConfig
} from "@/lib/demo-store";
import type {
  BankAccountConfigRecord,
  OrganizationConfigRecord,
  PageAccessKey,
  PaymentPartyConfigRecord,
  RoleConfigRecord,
  UserAccountRecord
} from "@/lib/types";

function toCurrency(value: string): BankAccountConfigRecord["currency"] {
  if (value === "CNY" || value === "USD") {
    return value;
  }
  return "RUB";
}

function toPartyType(value: string): PaymentPartyConfigRecord["type"] {
  if (value === "customer" || value === "internal" || value === "person") {
    return value;
  }
  return "supplier";
}

function toLegalForm(value: string): OrganizationConfigRecord["legalForm"] {
  if (value === "IP" || value === "AO" || value === "OTHER") {
    return value;
  }
  return "OOO";
}

function toTaxMode(value: string): OrganizationConfigRecord["taxMode"] {
  if (value === "USN" || value === "OTHER") {
    return value;
  }
  return "VAT";
}

function toSettlementRole(value: string): OrganizationConfigRecord["settlementRole"] {
  if (value === "import" || value === "brand" || value === "franchise" || value === "other") {
    return value;
  }
  return "operating";
}

function toOcrDocumentType(value: string) {
  if (value === "contract" || value === "voucher") {
    return value;
  }
  return "invoice";
}

function revalidateSettings() {
  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/settings/flows");
  revalidatePath("/dashboard/settings/organization");
  revalidatePath("/dashboard/settings/bank-accounts");
  revalidatePath("/dashboard/settings/exchange-rates");
  revalidatePath("/dashboard/settings/ledger-mappings");
  revalidatePath("/dashboard/settings/payment-parties");
  revalidatePath("/dashboard/settings/access");
  revalidatePath("/dashboard/settings/master-data");
  revalidatePath("/dashboard/settings/ocr-rules");
  revalidatePath("/dashboard/ocr");
  revalidatePath("/dashboard/requests/payments/new");
  revalidatePath("/dashboard/reports");
  revalidatePath("/dashboard");
}

async function requireConfigPermission(key: Parameters<typeof canManageConfig>[1]) {
  const session = await requirePageAccess("settings");
  if (!canManageConfig(session, key)) {
    redirect("/dashboard/settings");
  }
  return session;
}

export async function createOrganizationAction(formData: FormData) {
  await requireConfigPermission("organizations");
  const taxMode = toTaxMode(String(formData.get("taxMode") || "VAT"));
  const enableMultiCurrency = String(formData.get("enableMultiCurrency") || "") === "true";
  const enableExchangeRate = String(formData.get("enableExchangeRate") || "") === "true";
  const selectedCurrencies = formData.getAll("allowedCurrencies").map((item) => String(item));
  const allowedCurrencies = (selectedCurrencies.length > 0 ? selectedCurrencies : ["RUB"]).filter((item) =>
    ["RUB", "CNY", "USD"].includes(item)
  ) as Array<"RUB" | "CNY" | "USD">;
  await createOrganizationConfig({
    displayName: String(formData.get("displayName") || "").trim(),
    legalNameRu: String(formData.get("legalNameRu") || "").trim(),
    legalForm: toLegalForm(String(formData.get("legalForm") || "OOO")),
    taxMode,
    taxLabel: taxMode === "VAT" ? "НДС" : taxMode === "USN" ? "УСН" : "其他税制",
    baseCurrency: toCurrency(String(formData.get("baseCurrency") || "RUB")),
    enableMultiCurrency,
    enableExchangeRate: enableMultiCurrency && enableExchangeRate,
    allowedCurrencies,
    includeInGroupReport: String(formData.get("includeInGroupReport") || "") === "true",
    settlementRole: toSettlementRole(String(formData.get("settlementRole") || "operating"))
  });
  revalidateSettings();
  redirect("/dashboard/settings/organization");
}

export async function createDepartmentAction(formData: FormData) {
  await requireConfigPermission("masterData");
  await createDepartmentConfig({
    name: String(formData.get("name") || "").trim(),
    organization: String(formData.get("organization") || "").trim(),
    parentDepartmentId: String(formData.get("parentDepartmentId") || "").trim() || null,
    managerPersonId: String(formData.get("managerPersonId") || "").trim() || null
  });
  revalidateSettings();
  redirect("/dashboard/settings/master-data");
}

export async function toggleDepartmentAction(formData: FormData) {
  await requireConfigPermission("masterData");
  await toggleDepartmentConfig(String(formData.get("departmentId") || ""));
  revalidateSettings();
  redirect("/dashboard/settings/master-data");
}

export async function createProjectAction(formData: FormData) {
  await requireConfigPermission("masterData");
  const typeValue = String(formData.get("type") || "store");
  await createProjectConfig({
    name: String(formData.get("name") || "").trim(),
    organization: String(formData.get("organization") || "").trim(),
    type: typeValue === "project" || typeValue === "shared" ? typeValue : "store",
    code: String(formData.get("code") || "").trim(),
    managerPersonId: String(formData.get("managerPersonId") || "").trim() || null
  });
  revalidateSettings();
  redirect("/dashboard/settings/master-data");
}

export async function toggleProjectAction(formData: FormData) {
  await requireConfigPermission("masterData");
  await toggleProjectConfig(String(formData.get("projectId") || ""));
  revalidateSettings();
  redirect("/dashboard/settings/master-data");
}

export async function createPersonAction(formData: FormData) {
  await requireConfigPermission("masterData");
  await createPersonConfig({
    displayName: String(formData.get("displayName") || "").trim(),
    organization: String(formData.get("organization") || "").trim(),
    departmentId: String(formData.get("departmentId") || "").trim() || null,
    title: String(formData.get("title") || "").trim(),
    managerPersonId: String(formData.get("managerPersonId") || "").trim() || null,
    phone: String(formData.get("phone") || "").trim(),
    email: String(formData.get("email") || "").trim()
  });
  revalidateSettings();
  redirect("/dashboard/settings/master-data");
}

export async function togglePersonAction(formData: FormData) {
  await requireConfigPermission("masterData");
  await togglePersonConfig(String(formData.get("personId") || ""));
  revalidateSettings();
  redirect("/dashboard/settings/master-data");
}

export async function createOcrRuleAction(formData: FormData) {
  await requireConfigPermission("ocrRules");
  const requiredFields = formData
    .getAll("requiredFields")
    .map((item) => String(item))
    .filter((item) => ["amount", "companyName", "bankAccount", "documentDate", "contractSubject"].includes(item)) as Array<
    "amount" | "companyName" | "bankAccount" | "documentDate" | "contractSubject"
  >;
  await createOcrRuleConfig({
    name: String(formData.get("name") || "").trim(),
    documentType: toOcrDocumentType(String(formData.get("documentType") || "invoice")),
    organizationScope: formData.getAll("organizationScope").map((item) => String(item)),
    requiredFields,
    blockOnMismatch: String(formData.get("blockOnMismatch") || "") === "true"
  });
  revalidateSettings();
  redirect("/dashboard/settings/ocr-rules");
}

export async function toggleOcrRuleAction(formData: FormData) {
  await requireConfigPermission("ocrRules");
  await toggleOcrRuleConfig(String(formData.get("ruleId") || ""));
  revalidateSettings();
  redirect("/dashboard/settings/ocr-rules");
}

export async function toggleOcrRuleOrganizationScopeAction(formData: FormData) {
  await requireConfigPermission("ocrRules");
  await toggleOcrRuleOrganizationScope(String(formData.get("ruleId") || ""), String(formData.get("organizationName") || ""));
  revalidateSettings();
  redirect("/dashboard/settings/ocr-rules");
}

export async function toggleOrganizationAction(formData: FormData) {
  await requireConfigPermission("organizations");
  await toggleOrganizationConfig(String(formData.get("organizationId") || ""));
  revalidateSettings();
  redirect("/dashboard/settings/organization");
}

export async function toggleOrganizationGroupReportAction(formData: FormData) {
  await requireConfigPermission("organizations");
  await toggleOrganizationGroupReporting(String(formData.get("organizationId") || ""));
  revalidateSettings();
  redirect("/dashboard/settings/organization");
}

export async function toggleFlowTemplateAction(formData: FormData) {
  await requireConfigPermission("flows");
  await toggleApprovalFlowTemplate(String(formData.get("templateId") || ""));
  revalidateSettings();
  redirect("/dashboard/settings/flows");
}

export async function toggleFlowOrganizationScopeAction(formData: FormData) {
  await requireConfigPermission("flows");
  await toggleApprovalFlowOrganizationScope(
    String(formData.get("templateId") || ""),
    String(formData.get("organizationName") || "")
  );
  revalidateSettings();
  redirect("/dashboard/settings/flows");
}

export async function createBankAccountAction(formData: FormData) {
  await requireConfigPermission("bankAccounts");
  await createBankAccountConfig({
    organization: String(formData.get("organization") || "").trim(),
    accountName: String(formData.get("accountName") || "").trim(),
    bankName: String(formData.get("bankName") || "").trim(),
    accountNumber: String(formData.get("accountNumber") || "").trim(),
    currency: toCurrency(String(formData.get("currency") || "RUB")),
    balance: Number(formData.get("balance") || 0),
    isDefault: String(formData.get("isDefault") || "") === "true"
  });
  revalidateSettings();
  redirect("/dashboard/settings/bank-accounts");
}

export async function createExchangeRateAction(formData: FormData) {
  await requireConfigPermission("exchangeRates");
  await createExchangeRateConfig({
    organizationScope: formData.getAll("organizationScope").map((item) => String(item)),
    fromCurrency: toCurrency(String(formData.get("fromCurrency") || "RUB")),
    toCurrency: toCurrency(String(formData.get("toCurrency") || "RUB")),
    rate: Number(formData.get("rate") || 1),
    effectiveDate: String(formData.get("effectiveDate") || new Date().toISOString().slice(0, 10))
  });
  revalidateSettings();
  redirect("/dashboard/settings/exchange-rates");
}

export async function toggleExchangeRateAction(formData: FormData) {
  await requireConfigPermission("exchangeRates");
  await toggleExchangeRateConfig(String(formData.get("rateId") || ""));
  revalidateSettings();
  redirect("/dashboard/settings/exchange-rates");
}

export async function toggleExchangeRateOrganizationScopeAction(formData: FormData) {
  await requireConfigPermission("exchangeRates");
  await toggleExchangeRateOrganizationScope(
    String(formData.get("rateId") || ""),
    String(formData.get("organizationName") || "")
  );
  revalidateSettings();
  redirect("/dashboard/settings/exchange-rates");
}

export async function createLedgerAccountMappingAction(formData: FormData) {
  await requireConfigPermission("ledgerMappings");
  const scenarioValue = String(formData.get("scenario") || "standard_payment");
  await createLedgerAccountMappingConfig({
    organizationScope: formData.getAll("organizationScope").map((item) => String(item)),
    scenario:
      scenarioValue === "internal_transfer" || scenarioValue === "import_foreign_payment"
        ? scenarioValue
        : "standard_payment",
    accountCode: String(formData.get("accountCode") || "").trim(),
    accountName: String(formData.get("accountName") || "").trim()
  });
  revalidateSettings();
  redirect("/dashboard/settings/ledger-mappings");
}

export async function toggleLedgerAccountMappingAction(formData: FormData) {
  await requireConfigPermission("ledgerMappings");
  await toggleLedgerAccountMappingConfig(String(formData.get("mappingId") || ""));
  revalidateSettings();
  redirect("/dashboard/settings/ledger-mappings");
}

export async function toggleLedgerAccountMappingOrganizationScopeAction(formData: FormData) {
  await requireConfigPermission("ledgerMappings");
  await toggleLedgerAccountMappingOrganizationScope(
    String(formData.get("mappingId") || ""),
    String(formData.get("organizationName") || "")
  );
  revalidateSettings();
  redirect("/dashboard/settings/ledger-mappings");
}

export async function toggleBankAccountAction(formData: FormData) {
  await requireConfigPermission("bankAccounts");
  await toggleBankAccountConfig(String(formData.get("accountId") || ""));
  revalidateSettings();
  redirect("/dashboard/settings/bank-accounts");
}

export async function setDefaultBankAccountAction(formData: FormData) {
  await requireConfigPermission("bankAccounts");
  await setDefaultBankAccountConfig(String(formData.get("accountId") || ""));
  revalidateSettings();
  redirect("/dashboard/settings/bank-accounts");
}

export async function createPaymentPartyAction(formData: FormData) {
  await requireConfigPermission("paymentParties");
  await createPaymentPartyConfig({
    name: String(formData.get("name") || "").trim(),
    type: toPartyType(String(formData.get("type") || "supplier")),
    organizationScope: formData.getAll("organizationScope").map((item) => String(item)),
    bankName: String(formData.get("bankName") || "").trim(),
    bankAccount: String(formData.get("bankAccount") || "").trim(),
    contactName: String(formData.get("contactName") || "").trim(),
    phone: String(formData.get("phone") || "").trim()
  });
  revalidateSettings();
  redirect("/dashboard/settings/payment-parties");
}

export async function togglePaymentPartyAction(formData: FormData) {
  await requireConfigPermission("paymentParties");
  await togglePaymentPartyConfig(String(formData.get("partyId") || ""));
  revalidateSettings();
  redirect("/dashboard/settings/payment-parties");
}

export async function togglePaymentPartyOrganizationScopeAction(formData: FormData) {
  await requireConfigPermission("paymentParties");
  await togglePaymentPartyOrganizationScope(
    String(formData.get("partyId") || ""),
    String(formData.get("organizationName") || "")
  );
  revalidateSettings();
  redirect("/dashboard/settings/payment-parties");
}

export async function toggleFormFieldEnabledAction(formData: FormData) {
  await requireConfigPermission("forms");
  await togglePaymentFormFieldEnabled(String(formData.get("fieldId") || ""));
  revalidateSettings();
  redirect("/dashboard/settings/forms");
}

export async function toggleFormFieldRequiredAction(formData: FormData) {
  await requireConfigPermission("forms");
  await togglePaymentFormFieldRequired(String(formData.get("fieldId") || ""));
  revalidateSettings();
  redirect("/dashboard/settings/forms");
}

export async function toggleFormFieldOrganizationScopeAction(formData: FormData) {
  await requireConfigPermission("forms");
  await togglePaymentFormFieldOrganizationScope(
    String(formData.get("fieldId") || ""),
    String(formData.get("organizationName") || "")
  );
  revalidateSettings();
  redirect("/dashboard/settings/forms");
}

export async function createUserAccountAction(formData: FormData) {
  await requireConfigPermission("access");
  const roleValue = String(formData.get("role") || "applicant");
  const roles = await getRoleConfigViewAsync();
  const role = roles.find((item) => item.id === roleValue)?.id ?? "applicant";
  await createUserAccountConfig({
    username: String(formData.get("username") || "").trim(),
    password: String(formData.get("password") || "").trim(),
    displayName: String(formData.get("displayName") || "").trim(),
    role,
    organizationScope: formData.getAll("organizationScope").map((item) => String(item))
  });
  revalidateSettings();
  redirect("/dashboard/settings/access/accounts");
}

export async function toggleUserAccountAction(formData: FormData) {
  await requireConfigPermission("access");
  await toggleUserAccountConfig(String(formData.get("userId") || ""));
  revalidateSettings();
  redirect("/dashboard/settings/access/accounts");
}

export async function updateUserAccountRoleAction(formData: FormData) {
  await requireConfigPermission("access");
  const roleValue = String(formData.get("role") || "applicant");
  const roles = await getRoleConfigViewAsync();
  const role = roles.find((item) => item.id === roleValue)?.id ?? "applicant";
  await updateUserAccountRoleConfig(String(formData.get("userId") || ""), role);
  revalidateSettings();
  redirect("/dashboard/settings/access/accounts");
}

export async function resetUserAccountPasswordAction(formData: FormData) {
  await requireConfigPermission("access");
  await resetUserAccountPasswordConfig(
    String(formData.get("userId") || ""),
    String(formData.get("password") || "").trim()
  );
  revalidateSettings();
  redirect("/dashboard/settings/access/accounts");
}

export async function toggleUserOrganizationScopeAction(formData: FormData) {
  await requireConfigPermission("access");
  await toggleUserOrganizationScopeConfig(
    String(formData.get("userId") || ""),
    String(formData.get("organizationName") || "")
  );
  revalidateSettings();
  redirect("/dashboard/settings/access/organization-access");
}

export async function updateRoleDescriptionAction(formData: FormData) {
  await requireConfigPermission("access");
  await updateRoleDescriptionConfig(
    String(formData.get("roleId") || "") as RoleConfigRecord["id"],
    String(formData.get("description") || "").trim()
  );
  revalidateSettings();
  redirect("/dashboard/settings/access/roles");
}

export async function updateRoleDataScopeAction(formData: FormData) {
  await requireConfigPermission("access");
  const value = String(formData.get("dataScope") || "own");
  const dataScope: UserAccountRecord["role"] | RoleConfigRecord["dataScope"] =
    value === "all" || value === "organization" ? value : "own";
  await updateRoleDataScopeConfig(
    String(formData.get("roleId") || "") as RoleConfigRecord["id"],
    dataScope as RoleConfigRecord["dataScope"]
  );
  revalidateSettings();
  redirect("/dashboard/settings/access/data-access");
}

export async function toggleRolePageAccessAction(formData: FormData) {
  await requireConfigPermission("access");
  await toggleRolePageAccessConfig(
    String(formData.get("roleId") || "") as RoleConfigRecord["id"],
    String(formData.get("pageAccess") || "") as PageAccessKey
  );
  revalidateSettings();
  redirect("/dashboard/settings/access/page-access");
}

export async function toggleRoleApprovalPermissionAction(formData: FormData) {
  await requireConfigPermission("access");
  await toggleRoleApprovalPermissionConfig(
    String(formData.get("roleId") || "") as RoleConfigRecord["id"],
    String(formData.get("permissionKey") || "") as keyof RoleConfigRecord["approvalPermissions"]
  );
  revalidateSettings();
  redirect("/dashboard/settings/access/approval-access");
}

export async function toggleRoleConfigPermissionAction(formData: FormData) {
  await requireConfigPermission("access");
  await toggleRoleConfigPermissionConfig(
    String(formData.get("roleId") || "") as RoleConfigRecord["id"],
    String(formData.get("permissionKey") || "") as keyof RoleConfigRecord["configPermissions"]
  );
  revalidateSettings();
  redirect("/dashboard/settings/access/config-access");
}
