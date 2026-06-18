import type { PageAccessKey, UserAccountRecord } from "@/lib/types";

export const routeAccessMap: Array<{ prefix: string; key: PageAccessKey }> = [
  { prefix: "/dashboard/system-center", key: "system_center" },
  { prefix: "/dashboard/rules-center", key: "rules_center" },
  { prefix: "/dashboard/master-data-center", key: "master_data_center" },
  { prefix: "/dashboard/finance-center", key: "finance_center" },
  { prefix: "/dashboard/business-center", key: "business_center" },
  { prefix: "/dashboard/settings/access", key: "settings_access" },
  { prefix: "/dashboard/settings/ocr-rules", key: "settings_ocr_rules" },
  { prefix: "/dashboard/settings/master-data", key: "settings_master_data" },
  { prefix: "/dashboard/settings/organization", key: "settings_organization" },
  { prefix: "/dashboard/settings/flows", key: "settings_flows" },
  { prefix: "/dashboard/settings/forms", key: "settings_forms" },
  { prefix: "/dashboard/settings/bank-accounts", key: "settings_bank_accounts" },
  { prefix: "/dashboard/settings/exchange-rates", key: "settings_exchange_rates" },
  { prefix: "/dashboard/settings/ledger-mappings", key: "settings_ledger_mappings" },
  { prefix: "/dashboard/settings/payment-parties", key: "settings_payment_parties" },
  { prefix: "/dashboard/settings", key: "settings" },
  { prefix: "/dashboard/ocr", key: "ocr_workbench" },
  { prefix: "/dashboard/approvals", key: "approvals" },
  { prefix: "/dashboard/requests/payments", key: "payment_requests" },
  { prefix: "/dashboard/requests/purchases", key: "purchase_requests" },
  { prefix: "/dashboard/requests/contracts", key: "contract_requests" },
  { prefix: "/dashboard/execution", key: "payment_execution" },
  { prefix: "/dashboard/ledger", key: "ledger" },
  { prefix: "/dashboard/reports", key: "reports" },
  { prefix: "/dashboard", key: "dashboard" }
];

export function resolvePageAccessKey(pathname: string): PageAccessKey {
  const matched = routeAccessMap.find((item) => pathname.startsWith(item.prefix));
  return matched?.key ?? "dashboard";
}

export function canAccessPage(
  roleConfig: { pageAccess: PageAccessKey[] },
  page: PageAccessKey
) {
  return roleConfig.pageAccess.includes(page);
}

export function canAccessOrganization(
  user: Pick<UserAccountRecord, "organizationScope">,
  organization: string | null | undefined
) {
  if (!organization) {
    return true;
  }
  return user.organizationScope.includes(organization);
}
