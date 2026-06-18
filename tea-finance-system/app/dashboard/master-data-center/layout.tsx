import type { Route } from "next";
import Link from "next/link";
import { requirePageAccess } from "@/lib/auth";

const subNav = [
  { href: "/dashboard/master-data-center/organization" as Route, label: "组织与税务配置" },
  { href: "/dashboard/master-data-center/master-data" as Route, label: "主数据体系" },
  { href: "/dashboard/master-data-center/bank-accounts" as Route, label: "银行账户配置" },
  { href: "/dashboard/master-data-center/payment-parties" as Route, label: "付款对象资料库" }
];

export default async function MasterDataCenterLayout({
  children
}: {
  children: React.ReactNode;
}) {
  await requirePageAccess("master_data_center");

  return (
    <main className="space-y-4">
      <header className="rounded-lg border border-line bg-white px-6 py-5">
        <h1 className="text-2xl font-semibold">门店与组织</h1>
      </header>
      <nav className="rounded-lg border border-line bg-white p-2">
        <div className="flex flex-wrap gap-2">
          {subNav.map((item) => (
            <Link key={item.href} href={item.href} className="rounded-md border border-line bg-paper px-4 py-2 text-sm font-medium text-ink">
              {item.label}
            </Link>
          ))}
        </div>
      </nav>
      {children}
    </main>
  );
}
