import type { Route } from "next";
import Link from "next/link";
import { requirePageAccess } from "@/lib/auth";

const subNav = [
  { href: "/dashboard/rules-center/flows" as Route, label: "审批流配置" },
  { href: "/dashboard/rules-center/forms" as Route, label: "表单配置" },
  { href: "/dashboard/rules-center/ocr-rules" as Route, label: "OCR 规则配置" },
  { href: "/dashboard/rules-center/ledger-mappings" as Route, label: "总账科目映射" },
  { href: "/dashboard/rules-center/exchange-rates" as Route, label: "汇率配置" }
];

export default async function RulesCenterLayout({
  children
}: {
  children: React.ReactNode;
}) {
  await requirePageAccess("rules_center");

  return (
    <main className="space-y-4">
      <header className="rounded-lg border border-line bg-white px-6 py-5">
        <h1 className="text-2xl font-semibold">规则与配置</h1>
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
