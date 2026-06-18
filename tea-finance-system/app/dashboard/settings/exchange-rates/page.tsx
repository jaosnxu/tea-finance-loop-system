import {
  createExchangeRateAction,
  toggleExchangeRateAction,
  toggleExchangeRateOrganizationScopeAction
} from "@/app/dashboard/settings/actions";
import {
  getExchangeRateConfigViewAsync,
  getExchangeRateReportRowsAsync,
  getExchangeRateSummaryAsync,
  getOrganizationConfigViewAsync
} from "@/lib/demo-store";

export default async function ExchangeRateSettingsPage() {
  const [organizations, rows, reportRows, metrics] = await Promise.all([
    getOrganizationConfigViewAsync(),
    getExchangeRateConfigViewAsync(),
    getExchangeRateReportRowsAsync(),
    getExchangeRateSummaryAsync()
  ]);
  const enabledOrganizations = organizations.filter((item) => item.isActive && item.enableExchangeRate);

  return (
    <main className="space-y-6">
      <header className="rounded-lg border border-line bg-white p-6">
        <div className="text-sm uppercase tracking-[0.18em] text-bronze">exchange rate settings</div>
        <h1 className="mt-2 text-3xl font-semibold">汇率配置</h1>
        <p className="mt-3 max-w-4xl text-sm leading-6 text-black/65">
          这里只给已启用外币和汇率的组织配置折算规则。
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "汇率总数", value: metrics.totalRates },
          { label: "启用汇率", value: metrics.activeRates },
          { label: "覆盖组织", value: metrics.coveredOrganizations },
          { label: "币种对", value: metrics.currencyPairs }
        ].map((item) => (
          <div key={item.label} className="rounded-lg border border-line bg-white p-5">
            <div className="text-sm text-black/55">{item.label}</div>
            <div className="mt-3 text-2xl font-semibold">{item.value}</div>
          </div>
        ))}
      </section>

      <section className="rounded-lg border border-line bg-white p-6">
        <div className="mb-4">
          <div className="text-lg font-semibold">新增汇率</div>
          <div className="mt-1 text-sm text-black/55">只给需要外币折算的组织配置汇率。</div>
        </div>
        <form action={createExchangeRateAction} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <SelectField
              name="fromCurrency"
              label="原币"
              options={[
                { value: "CNY", label: "CNY" },
                { value: "USD", label: "USD" },
                { value: "RUB", label: "RUB" }
              ]}
            />
            <SelectField
              name="toCurrency"
              label="折算本位币"
              options={[{ value: "RUB", label: "RUB" }]}
            />
            <Field name="rate" label="汇率" placeholder="例如：11.90" type="number" step="0.0001" />
            <Field name="effectiveDate" label="生效日期" placeholder="YYYY-MM-DD" type="date" />
          </div>
          <div>
            <div className="text-sm font-medium text-black/70">适用组织</div>
            <div className="mt-2 flex flex-wrap gap-4 text-sm text-black/70">
              {enabledOrganizations.map((organization) => (
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
          <button className="rounded-md bg-ink px-5 py-3 text-sm font-medium text-white">新增汇率</button>
        </form>
      </section>

      <section className="rounded-lg border border-line bg-white">
        <div className="border-b border-line px-6 py-4">
          <div className="text-lg font-semibold">汇率策略视图</div>
          <div className="mt-1 text-sm text-black/55">总账入账时，会按组织、原币、日期匹配这里的有效汇率。</div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead className="bg-paper">
              <tr>
                {["原币", "本位币", "汇率", "生效日期", "适用组织", "状态"].map((label) => (
                  <th key={label} className="px-6 py-3 font-medium text-black/60">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {reportRows.map((row) => (
                <tr key={row.id} className="border-t border-line">
                  <td className="px-6 py-4">{row.fromCurrency}</td>
                  <td className="px-6 py-4">{row.toCurrency}</td>
                  <td className="px-6 py-4">{row.rate}</td>
                  <td className="px-6 py-4">{row.effectiveDate}</td>
                  <td className="px-6 py-4">{row.organizationScope.join(" / ")}</td>
                  <td className="px-6 py-4">{row.isActive ? "启用" : "停用"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border border-line bg-white">
        <div className="border-b border-line px-6 py-4">
          <div className="text-lg font-semibold">汇率配置清单</div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead className="bg-paper">
              <tr>
                {["原币", "本位币", "汇率", "生效日期", "适用组织范围", "状态", "操作"].map((label) => (
                  <th key={label} className="px-6 py-3 font-medium text-black/60">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-line align-top">
                  <td className="px-6 py-4">{row.fromCurrency}</td>
                  <td className="px-6 py-4">{row.toCurrency}</td>
                  <td className="px-6 py-4">{row.rate}</td>
                  <td className="px-6 py-4">{row.effectiveDate}</td>
                  <td className="px-6 py-4">
                    <div className="flex max-w-xl flex-wrap gap-2">
                      {enabledOrganizations.map((organization) => {
                        const enabled = row.organizationScope.includes(organization.displayName);
                        return (
                          <form key={`${row.id}-${organization.id}`} action={toggleExchangeRateOrganizationScopeAction}>
                            <input type="hidden" name="rateId" value={row.id} />
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
                  <td className="px-6 py-4">{row.isActive ? "启用" : "停用"}</td>
                  <td className="px-6 py-4">
                    <form action={toggleExchangeRateAction}>
                      <input type="hidden" name="rateId" value={row.id} />
                      <button className="rounded-md border border-line bg-paper px-3 py-2 text-xs font-medium text-ink">
                        {row.isActive ? "停用" : "启用"}
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

function Field({
  name,
  label,
  placeholder,
  type = "text",
  step
}: {
  name: string;
  label: string;
  placeholder: string;
  type?: "text" | "number" | "date";
  step?: string;
}) {
  return (
    <div>
      <div className="text-sm font-medium text-black/70">{label}</div>
      <input
        name={name}
        type={type}
        step={step}
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
