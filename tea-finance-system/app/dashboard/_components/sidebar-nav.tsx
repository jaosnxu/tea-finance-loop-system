"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Route } from "next";

type NavItem = {
  href: Route;
  label: string;
  key: string;
};

type NavSection = {
  title: string;
  items: NavItem[];
};

function itemClass(active: boolean) {
  return active
    ? "block rounded-xl border border-bronze/20 bg-bronze px-3 py-2.5 text-sm font-medium text-white shadow-sm"
    : "block rounded-xl px-3 py-2.5 text-sm text-black/70 transition hover:bg-paper hover:text-ink";
}

export function DesktopSidebarNav({ sections }: { sections: NavSection[] }) {
  const pathname = usePathname();

  return (
    <nav className="space-y-5">
      {sections.map((section) => (
        <div key={section.title}>
          <div className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-black/38">
            {section.title}
          </div>
          <div className="space-y-1">
            {section.items.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link key={item.href} href={item.href} className={itemClass(active)}>
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

export function MobileSidebarNav({ sections }: { sections: NavSection[] }) {
  const pathname = usePathname();

  return (
    <details className="rounded-2xl border border-line bg-white shadow-sm lg:hidden">
      <summary className="cursor-pointer list-none px-4 py-4 text-sm font-semibold text-ink">
        导航与功能入口
      </summary>
      <div className="border-t border-line px-3 py-3">
        <div className="space-y-4">
          {sections.map((section) => (
            <div key={section.title}>
              <div className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-black/38">
                {section.title}
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {section.items.map((item) => {
                  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  return (
                    <Link key={item.href} href={item.href} className={itemClass(active)}>
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </details>
  );
}
