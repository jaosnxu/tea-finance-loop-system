import type { Route } from "next";
import { logoutAction } from "@/app/login/actions";
import { requireSession } from "@/lib/auth";
import { APP_NAME } from "@/lib/constants";
import { DesktopSidebarNav, MobileSidebarNav } from "@/app/dashboard/_components/sidebar-nav";

function getRoleLabel(role: string) {
  return {
    boss: "老板",
    finance: "财务",
    cashier: "出纳",
    applicant: "申请人"
  }[role] ?? role;
}

const navSections = [
  {
    title: "经营驾驶舱",
    items: [
      { href: "/dashboard" as Route, label: "经营总览", key: "dashboard" },
      { href: "/dashboard/reports" as Route, label: "经营报表", key: "reports" }
    ]
  },
  {
    title: "门店与组织",
    items: [
      { href: "/dashboard/master-data-center/organization" as Route, label: "组织与税务", key: "settings_organization" },
      { href: "/dashboard/master-data-center/master-data" as Route, label: "门店与人员", key: "settings_master_data" }
    ]
  },
  {
    title: "供应链与采购",
    items: [
      { href: "/dashboard/requests/purchases" as Route, label: "采购申请", key: "purchase_requests" },
      { href: "/dashboard/master-data-center/payment-parties" as Route, label: "供应商与付款对象", key: "settings_payment_parties" }
    ]
  },
  {
    title: "财务与结算",
    items: [
      { href: "/dashboard/requests/payments" as Route, label: "付款申请", key: "payment_requests" },
      { href: "/dashboard/execution" as Route, label: "付款执行", key: "payment_execution" },
      { href: "/dashboard/master-data-center/bank-accounts" as Route, label: "银行账户", key: "settings_bank_accounts" },
      { href: "/dashboard/requests/contracts" as Route, label: "合同审批", key: "contract_requests" },
      { href: "/dashboard/ledger" as Route, label: "总账", key: "ledger" },
      { href: "/dashboard/reports" as Route, label: "财务报表", key: "reports" },
      { href: "/dashboard/rules-center/exchange-rates" as Route, label: "汇率规则", key: "settings_exchange_rates" },
      { href: "/dashboard/rules-center/ledger-mappings" as Route, label: "科目映射", key: "settings_ledger_mappings" }
    ]
  },
  {
    title: "审批与稽核",
    items: [
      { href: "/dashboard/approvals" as Route, label: "审批中心", key: "approvals" },
      { href: "/dashboard/ocr" as Route, label: "OCR核对", key: "ocr_workbench" },
      { href: "/dashboard/requests/contracts" as Route, label: "合同审批", key: "contract_requests" }
    ]
  },
  {
    title: "规则与配置",
    items: [
      { href: "/dashboard/rules-center/flows" as Route, label: "审批流配置", key: "settings_flows" },
      { href: "/dashboard/rules-center/forms" as Route, label: "单据字段配置", key: "settings_forms" },
      { href: "/dashboard/rules-center/ocr-rules" as Route, label: "OCR规则配置", key: "settings_ocr_rules" },
      { href: "/dashboard/rules-center/ledger-mappings" as Route, label: "总账科目映射", key: "settings_ledger_mappings" },
      { href: "/dashboard/rules-center/exchange-rates" as Route, label: "汇率配置", key: "settings_exchange_rates" }
    ]
  },
  {
    title: "系统与权限",
    items: [
      { href: "/dashboard/system-center/accounts" as Route, label: "账号管理", key: "settings_access" },
      { href: "/dashboard/system-center/roles" as Route, label: "角色管理", key: "settings_access" },
      { href: "/dashboard/system-center/page-access" as Route, label: "页面权限", key: "settings_access" },
      { href: "/dashboard/system-center/data-access" as Route, label: "数据权限", key: "settings_access" },
      { href: "/dashboard/system-center/approval-access" as Route, label: "审批权限", key: "settings_access" },
      { href: "/dashboard/system-center/config-access" as Route, label: "配置权限", key: "settings_access" },
      { href: "/dashboard/system-center/organization-access" as Route, label: "组织访问范围", key: "settings_access" }
    ]
  }
];

export default async function DashboardLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();
  const visibleSections = navSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => session.pageAccess.includes(item.key as typeof session.pageAccess[number]))
    }))
    .filter((section) => section.items.length > 0);
  return (
    <div className="min-h-screen bg-paper text-ink">
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-6">
        <div className="mb-4 rounded-2xl border border-line bg-white px-4 py-4 shadow-sm lg:hidden">
          <div className="text-[11px] uppercase tracking-[0.22em] text-bronze">tea chain russia</div>
          <div className="mt-1 text-lg font-semibold">{APP_NAME}</div>
          <div className="mt-3 flex items-center justify-between rounded-2xl bg-paper px-3 py-3 text-sm">
            <div>
              <div className="font-medium">{session.displayName}</div>
              <div className="mt-1 text-black/55">{getRoleLabel(session.role)}</div>
            </div>
            <form action={logoutAction}>
              <button className="rounded-xl border border-line bg-white px-3 py-2 text-sm font-medium text-ink">
                退出登录
              </button>
            </form>
          </div>
        </div>

        <MobileSidebarNav sections={visibleSections} />

        <div className="mt-4 flex flex-col gap-6 lg:mt-0 lg:flex-row">
          <aside className="hidden lg:block lg:w-72">
            <div className="sticky top-6 rounded-[28px] border border-line bg-white p-5 shadow-sm">
              <div className="mb-6">
                <div className="text-[11px] uppercase tracking-[0.22em] text-bronze">tea chain russia</div>
                <div className="mt-1 text-xl font-semibold">{APP_NAME}</div>
              </div>
              <div className="mb-5 rounded-2xl bg-paper px-4 py-4 text-sm">
                <div className="font-medium">{session.displayName}</div>
                <div className="mt-1 text-black/55">{getRoleLabel(session.role)}</div>
              </div>
              <DesktopSidebarNav sections={visibleSections} />
              <form action={logoutAction} className="mt-6">
                <button className="w-full rounded-2xl border border-line bg-paper px-3 py-3 text-sm font-medium text-ink transition hover:bg-white">
                  退出登录
                </button>
              </form>
            </div>
          </aside>

          <section className="min-w-0 flex-1">
            <div className="mx-auto max-w-[min(100%,64rem)]">{children}</div>
          </section>
        </div>
      </div>
    </div>
  );
}
