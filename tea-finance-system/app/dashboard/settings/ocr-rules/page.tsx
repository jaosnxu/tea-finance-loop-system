import {
  createOcrRuleAction,
  toggleOcrRuleAction,
  toggleOcrRuleOrganizationScopeAction
} from "@/app/dashboard/settings/actions";
import { requirePageAccess } from "@/lib/auth";
import { getOcrRuleConfigViewAsync, getOcrRuleSummaryAsync, getOrganizationConfigViewAsync } from "@/lib/demo-store";

export default async function OcrRulesSettingsPage() {
  await requirePageAccess("settings_ocr_rules");
  const [summary, rules, organizations] = await Promise.all([
    getOcrRuleSummaryAsync(),
    getOcrRuleConfigViewAsync(),
    getOrganizationConfigViewAsync()
  ]);
  const activeOrganizations = organizations.filter((item) => item.isActive);

  return (
    <main className="space-y-6">
      <header className="rounded-lg border border-line bg-white p-6">
        <div className="text-sm uppercase tracking-[0.18em] text-bronze">ocr rules</div>
        <h1 className="mt-2 text-3xl font-semibold">OCR 规则配置</h1>
        <p className="mt-3 max-w-4xl text-sm leading-6 text-black/65">
          这里统一配置发票、合同、付款凭证的识别字段和异常阻断策略。
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "规则总数", value: summary.totalRules },
          { label: "启用规则", value: summary.enabledRules },
          { label: "阻断型规则", value: summary.blockingRules },
          { label: "覆盖组织", value: summary.coveredOrganizations }
        ].map((item) => (
          <div key={item.label} className="rounded-lg border border-line bg-white p-5">
            <div className="text-sm text-black/55">{item.label}</div>
            <div className="mt-3 text-2xl font-semibold">{item.value}</div>
          </div>
        ))}
      </section>

      <section className="rounded-lg border border-line bg-white p-6">
        <div className="mb-4">
          <div className="text-lg font-semibold">新增 OCR 规则</div>
          <div className="mt-1 text-sm text-black/55">每条规则对应一类单据和一组关键字段。</div>
        </div>
        <form action={createOcrRuleAction} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Field name="name" label="规则名称" placeholder="例如：门店付款发票规则" />
            <SelectField
              name="documentType"
              label="单据类型"
              options={[
                { value: "invoice", label: "发票" },
                { value: "contract", label: "合同" },
                { value: "voucher", label: "付款凭证" }
              ]}
            />
          </div>
          <div>
            <div className="text-sm font-medium text-black/70">关键字段</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {[
                ["amount", "金额"],
                ["companyName", "公司名称"],
                ["bankAccount", "银行账号"],
                ["documentDate", "日期"],
                ["contractSubject", "合同主体"]
              ].map(([value, label]) => (
                <label key={value} className="inline-flex items-center gap-2 rounded-full border border-line bg-paper px-3 py-2 text-xs text-black/70">
                  <input type="checkbox" name="requiredFields" value={value} className="h-4 w-4 rounded border-line" defaultChecked />
                  {label}
                </label>
              ))}
            </div>
          </div>
          <div>
            <div className="text-sm font-medium text-black/70">覆盖组织</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {activeOrganizations.map((organization) => (
                <label key={organization.id} className="inline-flex items-center gap-2 rounded-full border border-line bg-paper px-3 py-2 text-xs text-black/70">
                  <input type="checkbox" name="organizationScope" value={organization.displayName} className="h-4 w-4 rounded border-line" />
                  {organization.displayName}
                </label>
              ))}
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-black/70">
            <input type="checkbox" name="blockOnMismatch" value="true" defaultChecked className="h-4 w-4 rounded border-line" />
            识别不一致时阻断后续流转
          </label>
          <button className="rounded-md bg-ink px-5 py-3 text-sm font-medium text-white">新增规则</button>
        </form>
      </section>

      <section className="rounded-lg border border-line bg-white">
        <div className="border-b border-line px-6 py-4">
          <h2 className="text-lg font-semibold">OCR 规则清单</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead className="bg-paper">
              <tr>
                {["规则", "单据类型", "关键字段", "阻断", "覆盖组织", "状态", "操作"].map((label) => (
                  <th key={label} className="px-6 py-3 font-medium text-black/60">{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => (
                <tr key={rule.id} className="border-t border-line align-top">
                  <td className="px-6 py-4 font-medium">{rule.name}</td>
                  <td className="px-6 py-4">{rule.documentType}</td>
                  <td className="px-6 py-4">{rule.requiredFields.join(" / ")}</td>
                  <td className="px-6 py-4">{rule.blockOnMismatch ? "阻断" : "不阻断"}</td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-2">
                      {activeOrganizations.map((organization) => {
                        const selected = rule.organizationScope.includes(organization.displayName);
                        return (
                          <form key={`${rule.id}-${organization.id}`} action={toggleOcrRuleOrganizationScopeAction}>
                            <input type="hidden" name="ruleId" value={rule.id} />
                            <input type="hidden" name="organizationName" value={organization.displayName} />
                            <button className={`rounded-full border px-3 py-1 text-xs ${selected ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-line bg-paper text-black/60"}`}>
                              {organization.displayName}
                            </button>
                          </form>
                        );
                      })}
                    </div>
                  </td>
                  <td className="px-6 py-4">{rule.enabled ? "启用" : "停用"}</td>
                  <td className="px-6 py-4">
                    <form action={toggleOcrRuleAction}>
                      <input type="hidden" name="ruleId" value={rule.id} />
                      <button className="rounded-md border border-line bg-paper px-3 py-2 text-xs font-medium text-ink">
                        {rule.enabled ? "停用" : "启用"}
                      </button>
                    </form>
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

function Field({ name, label, placeholder }: { name: string; label: string; placeholder: string }) {
  return (
    <div>
      <div className="text-sm font-medium text-black/70">{label}</div>
      <input name={name} required placeholder={placeholder} className="mt-2 h-11 w-full rounded-md border border-line bg-white px-4 text-sm outline-none" />
    </div>
  );
}

function SelectField({
  name,
  label,
  options
}: {
  name: string;
  label: string;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div>
      <div className="text-sm font-medium text-black/70">{label}</div>
      <select name={name} required className="mt-2 h-11 w-full rounded-md border border-line bg-white px-4 text-sm outline-none">
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
