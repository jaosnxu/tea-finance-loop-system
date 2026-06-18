import {
  createLedgerAccountMappingAction,
  toggleLedgerAccountMappingAction,
  toggleLedgerAccountMappingOrganizationScopeAction
} from "@/app/dashboard/settings/actions";
import {
  getLedgerAccountMappingSummaryAsync,
  getLedgerAccountMappingViewAsync,
  getOrganizationConfigViewAsync
} from "@/lib/demo-store";

const scenarioLabels = {
  standard_payment: "标准付款",
  import_foreign_payment: "进出口外币付款",
  internal_transfer: "内部往来"
} as const;

export default async function LedgerMappingsSettingsPage() {
  const [mappings, metrics, organizations] = await Promise.all([
    getLedgerAccountMappingViewAsync(),
    getLedgerAccountMappingSummaryAsync(),
    getOrganizationConfigViewAsync()
  ]);
  const activeOrganizations = organizations.filter((item) => item.isActive);

  return (
    <main className="space-y-6">
      <header className="rounded-lg border border-line bg-white p-6">
        <div className="text-sm uppercase tracking-[0.18em] text-bronze">ledger mapping settings</div>
        <h1 className="mt-2 text-3xl font-semibold">总账科目映射</h1>
        <p className="mt-3 max-w-4xl text-sm leading-6 text-black/65">
          入账科目按后台配置决定。标准付款、进出口外币付款、内部往来分别挂映射，不再在代码里直接写死业务科目。
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "映射总数", value: metrics.totalMappings },
          { label: "启用映射", value: metrics.activeMappings },
          { label: "覆盖组织", value: metrics.coveredOrganizations },
          { label: "业务场景", value: metrics.scenarios }
        ].map((item) => (
          <div key={item.label} className="rounded-lg border border-line bg-white p-5">
            <div className="text-sm text-black/55">{item.label}</div>
            <div className="mt-3 text-2xl font-semibold">{item.value}</div>
          </div>
        ))}
      </section>

      <section className="rounded-lg border border-line bg-white p-6">
        <div className="mb-4">
          <div className="text-lg font-semibold">新增科目映射</div>
          <div className="mt-1 text-sm text-black/55">按组织和场景配置科目。业务口径变化优先改这里。</div>
        </div>
        <form action={createLedgerAccountMappingAction} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <SelectField
              name="scenario"
              label="业务场景"
              options={[
                { value: "standard_payment", label: "标准付款" },
                { value: "import_foreign_payment", label: "进出口外币付款" },
                { value: "internal_transfer", label: "内部往来" }
              ]}
            />
            <Field name="accountCode" label="科目编码" placeholder="例如：6601" />
            <Field name="accountName" label="科目名称" placeholder="例如：付款申请支出" />
          </div>
          <div>
            <div className="text-sm font-medium text-black/70">适用组织</div>
            <div className="mt-2 flex flex-wrap gap-4 text-sm text-black/70">
              {activeOrganizations.map((organization) => (
                <label key={organization.id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="organizationScope"
                    value={organization.displayName}
                    className="h-4 w-4 rounded border-line"
                  />
                  {organization.displayName}
                </label>
              ))}
            </div>
          </div>
          <button className="rounded-md bg-ink px-5 py-3 text-sm font-medium text-white">新增映射</button>
        </form>
      </section>

      <section className="rounded-lg border border-line bg-white">
        <div className="border-b border-line px-6 py-4">
          <div className="text-lg font-semibold">映射清单</div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead className="bg-paper">
              <tr>
                {["业务场景", "科目编码", "科目名称", "适用组织范围", "状态", "操作"].map((label) => (
                  <th key={label} className="px-6 py-3 font-medium text-black/60">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {mappings.map((mapping) => (
                <tr key={mapping.id} className="border-t border-line align-top">
                  <td className="px-6 py-4">{scenarioLabels[mapping.scenario]}</td>
                  <td className="px-6 py-4">{mapping.accountCode}</td>
                  <td className="px-6 py-4 font-medium">{mapping.accountName}</td>
                  <td className="px-6 py-4">
                    <div className="flex max-w-xl flex-wrap gap-2">
                      {activeOrganizations.map((organization) => {
                        const enabled = mapping.organizationScope.includes(organization.displayName);
                        return (
                          <form key={`${mapping.id}-${organization.id}`} action={toggleLedgerAccountMappingOrganizationScopeAction}>
                            <input type="hidden" name="mappingId" value={mapping.id} />
                            <input type="hidden" name="organizationName" value={organization.displayName} />
                            <button
                              className={`rounded-full border px-3 py-1 text-xs ${
                                enabled ? "border-ink bg-ink text-white" : "border-line bg-paper text-black/70"
                              }`}
                            >
                              {organization.displayName}
                            </button>
                          </form>
                        );
                      })}
                    </div>
                  </td>
                  <td className="px-6 py-4">{mapping.isActive ? "启用" : "停用"}</td>
                  <td className="px-6 py-4">
                    <form action={toggleLedgerAccountMappingAction}>
                      <input type="hidden" name="mappingId" value={mapping.id} />
                      <button className="rounded-md border border-line bg-paper px-3 py-2 text-xs font-medium text-ink">
                        {mapping.isActive ? "停用" : "启用"}
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
      <input
        name={name}
        required
        placeholder={placeholder}
        className="mt-2 h-11 w-full rounded-md border border-line bg-white px-4 text-sm outline-none placeholder:text-black/35"
      />
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
