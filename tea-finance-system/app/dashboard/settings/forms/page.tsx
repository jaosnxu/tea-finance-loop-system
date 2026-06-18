import {
  toggleFormFieldEnabledAction,
  toggleFormFieldOrganizationScopeAction,
  toggleFormFieldRequiredAction
} from "@/app/dashboard/settings/actions";
import {
  getOrganizationConfigViewAsync,
  getPaymentFormTemplateSummaryAsync,
  getPaymentFormTemplateViewAsync
} from "@/lib/demo-store";

const fieldTypeLabel = {
  text: "文本",
  number: "数字",
  textarea: "备注 / 长文本",
  select: "下拉选择",
  attachment: "附件"
} as const;

const sectionLabel = {
  basic: "基础信息",
  party: "付款对象",
  finance: "金额与往来",
  purpose: "用途说明",
  attachments: "附件"
} as const;

export default async function FormSettingsPage() {
  const [template, metrics, organizations] = await Promise.all([
    getPaymentFormTemplateViewAsync(),
    getPaymentFormTemplateSummaryAsync(),
    getOrganizationConfigViewAsync()
  ]);
  const activeOrganizations = organizations.filter((item) => item.isActive);

  return (
    <main className="space-y-6">
      <header className="rounded-lg border border-line bg-white p-6">
        <div className="text-sm uppercase tracking-[0.18em] text-bronze">form settings</div>
        <h1 className="mt-2 text-3xl font-semibold">表单配置</h1>
        <p className="mt-3 max-w-4xl text-sm leading-6 text-black/65">
          这里统一管字段模板、分区、必填规则和组织范围，改业务优先改配置，不直接改页面。
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "模板名称", value: template.name },
          { label: "字段数量", value: String(metrics.totalFields) },
          { label: "必填字段", value: String(metrics.requiredFields) },
          { label: "附件字段", value: String(metrics.attachmentFields) }
        ].map((item) => (
          <div key={item.label} className="rounded-lg border border-line bg-white p-5">
            <div className="text-sm text-black/55">{item.label}</div>
            <div className="mt-3 text-xl font-semibold">{item.value}</div>
          </div>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
        <div className="rounded-lg border border-line bg-white p-6">
          <h2 className="text-lg font-semibold">表单分区</h2>
          <div className="mt-4 space-y-4">
            {template.sections.map((section) => (
              <div key={section.id} className="rounded-md border border-line bg-paper px-4 py-4">
                <div className="text-sm font-medium">{section.label}</div>
                {section.description ? <div className="mt-1 text-sm text-black/55">{section.description}</div> : null}
                <div className="mt-2 text-xs text-black/45">
                  字段数：{template.fields.filter((field) => field.section === section.id).length}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-line bg-white">
          <div className="border-b border-line px-6 py-4">
            <h2 className="text-lg font-semibold">字段模板</h2>
            <p className="mt-1 text-sm text-black/55">字段顺序、必填、类型和组织范围都从配置读取。</p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-left text-sm">
              <thead className="bg-paper">
                <tr>
                  {["字段名", "字段标识", "分区", "类型", "启用", "必填", "组织范围", "宽度", "选项 / 说明", "操作"].map((label) => (
                    <th key={label} className="px-6 py-3 font-medium text-black/60">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {template.fields.map((field) => (
                  <tr key={field.id} className="border-t border-line align-top">
                    <td className="px-6 py-4 font-medium">{field.label}</td>
                    <td className="px-6 py-4 text-black/60">{field.name}</td>
                    <td className="px-6 py-4">{sectionLabel[field.section]}</td>
                    <td className="px-6 py-4">{fieldTypeLabel[field.type]}</td>
                    <td className="px-6 py-4">{field.enabled === false ? "否" : "是"}</td>
                    <td className="px-6 py-4">{field.required ? "是" : "否"}</td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-2">
                        {activeOrganizations.map((organization) => {
                          const included = (field.organizationScope ?? []).includes(organization.displayName);
                          return (
                            <form key={organization.id} action={toggleFormFieldOrganizationScopeAction}>
                              <input type="hidden" name="fieldId" value={field.id} />
                              <input type="hidden" name="organizationName" value={organization.displayName} />
                              <button
                                className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                                  included ? "bg-emerald-50 text-emerald-700" : "border border-line bg-paper text-black/60"
                                }`}
                              >
                                {organization.displayName}
                              </button>
                            </form>
                          );
                        })}
                      </div>
                    </td>
                    <td className="px-6 py-4">{field.width === "full" ? "整行" : "半行"}</td>
                    <td className="px-6 py-4 text-black/60">
                      {field.options && field.options.length > 0
                        ? field.options.map((item) => item.label).join(" / ")
                        : field.note ?? field.placeholder ?? "-"}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-2">
                        <form action={toggleFormFieldEnabledAction}>
                          <input type="hidden" name="fieldId" value={field.id} />
                          <button className="rounded-md border border-line bg-paper px-3 py-2 text-xs font-medium text-ink">
                            {field.enabled === false ? "启用字段" : "停用字段"}
                          </button>
                        </form>
                        <form action={toggleFormFieldRequiredAction}>
                          <input type="hidden" name="fieldId" value={field.id} />
                          <button className="rounded-md border border-line bg-paper px-3 py-2 text-xs font-medium text-ink">
                            {field.required ? "改可选" : "改必填"}
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-line bg-white p-6">
        <h2 className="text-lg font-semibold">使用原则</h2>
        <ul className="mt-4 space-y-3 text-sm leading-6 text-black/65">
          <li>页面按模板输出，不再写死字段顺序。</li>
          <li>字段启停、必填和组织差异都优先走配置。</li>
          <li>前台尽量只做选择和核对。</li>
        </ul>
      </section>
    </main>
  );
}
