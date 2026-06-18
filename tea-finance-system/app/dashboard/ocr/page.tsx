import Link from "next/link";
import type { Route } from "next";
import { unstable_noStore as noStore } from "next/cache";

import { requirePageAccess } from "@/lib/auth";
import { getOcrWorkbenchRowsAsync, getOrganizationConfigViewAsync } from "@/lib/demo-store";
import { ocrStatusLabels, paymentStatusLabels } from "@/lib/mock-data";

type OcrWorkbenchPageProps = {
  searchParams?: Promise<{
    organization?: string;
    mode?: "all" | "pending" | "exception" | "confirmed";
  }>;
};

export default async function OcrWorkbenchPage({ searchParams }: OcrWorkbenchPageProps) {
  noStore();
  await requirePageAccess("ocr_workbench");
  const params = (await searchParams) ?? {};
  const organization = params.organization ?? "all";
  const mode = params.mode ?? "all";
  const [rows, organizations] = await Promise.all([
    getOcrWorkbenchRowsAsync({ organization, mode }),
    getOrganizationConfigViewAsync()
  ]);
  const activeOrganizations = organizations.filter((item) => item.isActive);

  return (
    <main className="space-y-6">
      <header className="rounded-lg border border-line bg-white p-6">
        <div className="text-sm uppercase tracking-[0.18em] text-bronze">ocr workbench</div>
        <h1 className="mt-2 text-3xl font-semibold">OCR 核对工作台</h1>
        <p className="mt-3 max-w-4xl text-sm leading-6 text-black/65">
          这里专门处理 OCR 识别、字段比对和异常确认。先判断单据能不能继续流转，再决定是否进入详情页。
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "待识别 / 待核对", value: rows.filter((item) => item.requestStatus === "ocr_pending").length },
          { label: "异常待确认", value: rows.filter((item) => item.requestStatus === "ocr_exception_pending_confirm").length },
          { label: "已人工确认", value: rows.filter((item) => item.ocrStatus === "confirmed_exception").length },
          { label: "识别一致", value: rows.filter((item) => item.ocrStatus === "matched").length }
        ].map((item) => (
          <div key={item.label} className="rounded-lg border border-line bg-white p-5">
            <div className="text-sm text-black/55">{item.label}</div>
            <div className="mt-3 text-2xl font-semibold">{item.value}</div>
          </div>
        ))}
      </section>

      <section className="rounded-lg border border-line bg-white p-6">
        <div className="flex flex-wrap gap-2">
          {[
            ["all", "全部"],
            ["pending", "待识别/待核对"],
            ["exception", "异常待确认"],
            ["confirmed", "已确认/已一致"]
          ].map(([value, label]) => (
            <Link
              key={value}
              href={`/dashboard/ocr?mode=${value}&organization=${organization}` as Route}
              className={`rounded-full border px-3 py-2 text-xs ${mode === value ? "border-ink bg-ink text-white" : "border-line bg-paper text-black/70"}`}
            >
              {label}
            </Link>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            href={`/dashboard/ocr?mode=${mode}&organization=all` as Route}
            className={`rounded-full border px-3 py-2 text-xs ${organization === "all" ? "border-ink bg-ink text-white" : "border-line bg-paper text-black/70"}`}
          >
            全部组织
          </Link>
          {activeOrganizations.map((item) => (
            <Link
              key={item.id}
              href={`/dashboard/ocr?mode=${mode}&organization=${encodeURIComponent(item.displayName)}` as Route}
              className={`rounded-full border px-3 py-2 text-xs ${organization === item.displayName ? "border-ink bg-ink text-white" : "border-line bg-paper text-black/70"}`}
            >
              {item.displayName}
            </Link>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-line bg-white">
        <div className="border-b border-line px-6 py-4">
          <h2 className="text-lg font-semibold">OCR 核对队列</h2>
          <div className="mt-1 text-sm text-black/55">先看异常字段和处理人，再决定是否进入详情页。</div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead className="bg-paper">
              <tr>
                {["编号", "标题", "组织", "单据类型", "OCR状态", "当前状态", "匹配", "异常", "处理人", "说明", "动作"].map((label) => (
                  <th key={label} className="px-6 py-3 font-medium text-black/60">{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-line align-top">
                  <td className="px-6 py-4 font-medium">{row.id}</td>
                  <td className="px-6 py-4">{row.title}</td>
                  <td className="px-6 py-4">{row.organization}</td>
                  <td className="px-6 py-4">{row.documentType}</td>
                  <td className="px-6 py-4">{ocrStatusLabels[row.ocrStatus]}</td>
                  <td className="px-6 py-4">{paymentStatusLabels[row.requestStatus]}</td>
                  <td className="px-6 py-4">{row.matchedCount}</td>
                  <td className="px-6 py-4">{row.mismatchedCount}</td>
                  <td className="px-6 py-4">{row.currentHandler}</td>
                  <td className="px-6 py-4">{row.note}</td>
                  <td className="px-6 py-4">
                    <Link href={`/dashboard/requests/payments/${row.id}` as Route} className="rounded-md border border-line bg-paper px-3 py-2 text-xs font-medium text-ink">
                      进入处理
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
