import type { Route } from "next";
import Link from "next/link";
import { requirePageAccess } from "@/lib/auth";

const subNav = [
  { href: "/dashboard/settings/access/accounts" as Route, label: "账号管理" },
  { href: "/dashboard/settings/access/roles" as Route, label: "角色管理" },
  { href: "/dashboard/settings/access/page-access" as Route, label: "页面权限" },
  { href: "/dashboard/settings/access/data-access" as Route, label: "数据权限" },
  { href: "/dashboard/settings/access/approval-access" as Route, label: "审批权限" },
  { href: "/dashboard/settings/access/config-access" as Route, label: "配置权限" },
  { href: "/dashboard/settings/access/organization-access" as Route, label: "组织访问范围" }
];

export default async function AccessLayout({
  children
}: {
  children: React.ReactNode;
}) {
  await requirePageAccess("settings_access");

  return (
    <main className="space-y-4">
      <header className="rounded-lg border border-line bg-white px-6 py-5">
        <h1 className="text-2xl font-semibold">权限与账号</h1>
      </header>

      <nav className="rounded-lg border border-line bg-white p-2">
        <div className="flex flex-wrap gap-2">
          {subNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md border border-line bg-paper px-4 py-2 text-sm font-medium text-ink"
            >
              {item.label}
            </Link>
          ))}
        </div>
      </nav>

      {children}
    </main>
  );
}
