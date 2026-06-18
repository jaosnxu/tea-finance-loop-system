import {
  createOrganizationAction,
  toggleOrganizationAction,
  toggleOrganizationGroupReportAction
} from "@/app/dashboard/settings/actions";
import { getOrganizationConfigViewAsync, getOrganizationSummaryAsync } from "@/lib/demo-store";

const taxModeTone: Record<string, string> = {
  VAT: "bg-emerald-50 text-emerald-700",
  USN: "bg-amber-50 text-amber-700",
  OTHER: "bg-slate-100 text-slate-700"
};

export default async function OrganizationSettingsPage() {
  const [organizations, metrics] = await Promise.all([
    getOrganizationConfigViewAsync(),
    getOrganizationSummaryAsync()
  ]);

  return (
    <main className="space-y-6">
      <header className="rounded-lg border border-line bg-white p-6">
        <div className="text-sm uppercase tracking-[0.18em] text-bronze">organization settings</div>
        <h1 className="mt-2 text-3xl font-semibold">组织与税务配置</h1>
        <p className="mt-3 max-w-4xl text-sm leading-6 text-black/65">
          按俄罗斯业务场景管理组织主体。税务方式、汇总范围、结算角色和币种能力都由后台配置。
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {[
          { label: "组织总数", value: metrics.totalOrganizations },
          { label: "启用组织", value: metrics.activeOrganizations },
          { label: "纳入集团汇总", value: metrics.groupReportingOrganizations },
          { label: "增值税主体", value: metrics.vatOrganizations },
          { label: "简化税主体", value: metrics.usnOrganizations }
        ].map((item) => (
          <div key={item.label} className="rounded-lg border border-line bg-white p-5">
            <div className="text-sm text-black/55">{item.label}</div>
            <div className="mt-3 text-2xl font-semibold">{item.value}</div>
          </div>
        ))}
      </section>

      <section className="rounded-lg border border-line bg-white p-6">
        <div className="mb-4">
          <div className="text-lg font-semibold">新增组织</div>
          <div className="mt-1 text-sm text-black/55">这里新增、停用组织，并配置汇总范围、税务方式和币种能力。</div>
        </div>
        <form action={createOrganizationAction} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Field name="displayName" label="组织名称" placeholder="例如：莫斯科直营店主体" />
            <Field name="legalNameRu" label="俄文主体" placeholder="例如：OOO Tea Moscow Store" />
            <SelectField
              name="legalForm"
              label="法律形态"
              options={[
                { value: "OOO", label: "OOO" },
                { value: "IP", label: "IP" },
                { value: "AO", label: "AO" },
                { value: "OTHER", label: "OTHER" }
              ]}
            />
            <SelectField
              name="taxMode"
              label="税务方式"
              options={[
                { value: "VAT", label: "НДС / VAT" },
                { value: "USN", label: "УСН / USN" },
                { value: "OTHER", label: "其他税制" }
              ]}
            />
            <SelectField
              name="baseCurrency"
              label="本位币"
              options={[
                { value: "RUB", label: "RUB" },
                { value: "CNY", label: "CNY" },
                { value: "USD", label: "USD" }
              ]}
            />
            <SelectField
              name="settlementRole"
              label="结算角色"
              options={[
                { value: "operating", label: "operating" },
                { value: "import", label: "import" },
                { value: "brand", label: "brand" },
                { value: "franchise", label: "franchise" },
                { value: "other", label: "other" }
              ]}
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-black/70">
            <input type="checkbox" name="includeInGroupReport" value="true" className="h-4 w-4 rounded border-line" />
            纳入老板集团汇总报表
          </label>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="flex items-center gap-2 text-sm text-black/70">
              <input type="checkbox" name="enableMultiCurrency" value="true" className="h-4 w-4 rounded border-line" />
              启用多币种
            </label>
            <label className="flex items-center gap-2 text-sm text-black/70">
              <input type="checkbox" name="enableExchangeRate" value="true" className="h-4 w-4 rounded border-line" />
              启用汇率
            </label>
          </div>
          <div>
            <div className="text-sm font-medium text-black/70">允许币种</div>
            <div className="mt-2 flex flex-wrap gap-4 text-sm text-black/70">
              {["RUB", "CNY", "USD"].map((currency) => (
                <label key={currency} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="allowedCurrencies"
                    value={currency}
                    defaultChecked={currency === "RUB"}
                    className="h-4 w-4 rounded border-line"
                  />
                  {currency}
                </label>
              ))}
            </div>
          </div>
          <button className="rounded-md bg-ink px-5 py-3 text-sm font-medium text-white">新增组织</button>
        </form>
      </section>

      <section className="rounded-lg border border-line bg-white">
        <div className="border-b border-line px-6 py-4">
          <h2 className="text-lg font-semibold">组织主数据</h2>
          <p className="mt-1 text-sm text-black/55">以俄文主体和税务口径为先，当前页面用中文测试。</p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-sand/30 text-black/55">
              <tr>
                <th className="px-6 py-3 font-medium">组织名称</th>
                <th className="px-6 py-3 font-medium">俄文主体</th>
                <th className="px-6 py-3 font-medium">税务方式</th>
                <th className="px-6 py-3 font-medium">本位币</th>
                <th className="px-6 py-3 font-medium">多币种/汇率</th>
                <th className="px-6 py-3 font-medium">允许币种</th>
                <th className="px-6 py-3 font-medium">结算角色</th>
                <th className="px-6 py-3 font-medium">银行账户</th>
                <th className="px-6 py-3 font-medium">项目数</th>
                <th className="px-6 py-3 font-medium">部门数</th>
                <th className="px-6 py-3 font-medium">集团汇总</th>
                <th className="px-6 py-3 font-medium">状态</th>
                <th className="px-6 py-3 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {organizations.map((organization) => (
                <tr key={organization.id} className="border-t border-line align-top">
                  <td className="px-6 py-4 font-medium text-black">{organization.displayName}</td>
                  <td className="px-6 py-4 text-black/70">{organization.legalNameRu}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${taxModeTone[organization.taxMode]}`}>
                      {organization.taxLabel}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-black/70">{organization.baseCurrency}</td>
                  <td className="px-6 py-4 text-black/70">
                    {organization.enableMultiCurrency ? "多币种" : "单币种"} / {organization.enableExchangeRate ? "启用汇率" : "无汇率"}
                  </td>
                  <td className="px-6 py-4 text-black/70">{organization.allowedCurrencies.join(" / ")}</td>
                  <td className="px-6 py-4 text-black/70">{organization.settlementRole}</td>
                  <td className="px-6 py-4 text-black/70">{organization.bankAccountCount}</td>
                  <td className="px-6 py-4 text-black/70">{organization.projectCount}</td>
                  <td className="px-6 py-4 text-black/70">{organization.departmentCount}</td>
                  <td className="px-6 py-4 text-black/70">{organization.includeInGroupReport ? "参与" : "不参与"}</td>
                  <td className="px-6 py-4 text-black/70">{organization.isActive ? "启用" : "停用"}</td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-2">
                      <form action={toggleOrganizationAction}>
                        <input type="hidden" name="organizationId" value={organization.id} />
                        <button className="rounded-md border border-line bg-paper px-3 py-2 text-xs font-medium text-ink">
                          {organization.isActive ? "停用" : "启用"}
                        </button>
                      </form>
                      <form action={toggleOrganizationGroupReportAction}>
                        <input type="hidden" name="organizationId" value={organization.id} />
                        <button className="rounded-md border border-line bg-paper px-3 py-2 text-xs font-medium text-ink">
                          {organization.includeInGroupReport ? "移出汇总" : "纳入汇总"}
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-lg border border-line bg-white p-6">
          <h2 className="text-lg font-semibold">配置原则</h2>
          <ul className="mt-4 space-y-3 text-sm leading-6 text-black/65">
            <li>组织数量可以增加、减少、停用，不写死。</li>
            <li>税务方式挂在组织层，后续支持继续扩展。</li>
            <li>是否启用多币种、是否启用汇率、允许哪些币种，都挂在组织层配置。</li>
            <li>是否纳入老板的集团合并报表，由后台独立控制。</li>
            <li>前端展示组件按俄文长度预留空间，不压缩字段。</li>
          </ul>
        </div>

        <div className="rounded-lg border border-line bg-white p-6">
          <h2 className="text-lg font-semibold">配置范围</h2>
          <ul className="mt-4 space-y-3 text-sm leading-6 text-black/65">
            <li>组织基本信息</li>
            <li>俄文主体名称与法律形态</li>
            <li>税务方式与本位币</li>
            <li>多币种、汇率与允许币种</li>
            <li>银行账户数量与结算角色</li>
            <li>是否参与集团汇总报表</li>
          </ul>
        </div>
      </section>
    </main>
  );
}

function Field({
  name,
  label,
  placeholder,
  type = "text"
}: {
  name: string;
  label: string;
  placeholder: string;
  type?: "text" | "number";
}) {
  return (
    <div>
      <div className="text-sm font-medium text-black/70">{label}</div>
      <input
        name={name}
        type={type}
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
