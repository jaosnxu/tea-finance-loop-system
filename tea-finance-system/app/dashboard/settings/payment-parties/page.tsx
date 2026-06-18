import {
  createPaymentPartyAction,
  togglePaymentPartyAction,
  togglePaymentPartyOrganizationScopeAction
} from "@/app/dashboard/settings/actions";
import {
  getOrganizationConfigViewAsync,
  getPaymentPartyConfigViewAsync,
  getPaymentPartySummaryAsync
} from "@/lib/demo-store";

const typeLabel = {
  supplier: "供应商",
  customer: "客户",
  internal: "内部组织",
  person: "个人"
} as const;

export default async function PaymentPartiesSettingsPage() {
  const [parties, metrics, organizations] = await Promise.all([
    getPaymentPartyConfigViewAsync(),
    getPaymentPartySummaryAsync(),
    getOrganizationConfigViewAsync()
  ]);
  const activeOrganizations = organizations.filter((item) => item.isActive);

  return (
    <main className="space-y-6">
      <header className="rounded-lg border border-line bg-white p-6">
        <div className="text-sm uppercase tracking-[0.18em] text-bronze">payment party settings</div>
        <h1 className="mt-2 text-3xl font-semibold">付款对象资料库</h1>
        <p className="mt-3 max-w-4xl text-sm leading-6 text-black/65">
          这里集中维护付款对象资料，减少重复录入和银行信息错误。
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "对象总数", value: metrics.totalParties },
          { label: "启用对象", value: metrics.activeParties },
          { label: "内部对象", value: metrics.internalParties },
          { label: "供应商", value: metrics.supplierParties }
        ].map((item) => (
          <div key={item.label} className="rounded-lg border border-line bg-white p-5">
            <div className="text-sm text-black/55">{item.label}</div>
            <div className="mt-3 text-2xl font-semibold">{item.value}</div>
          </div>
        ))}
      </section>

      <section className="rounded-lg border border-line bg-white p-6">
        <div className="mb-4">
          <div className="text-lg font-semibold">新增付款对象</div>
          <div className="mt-1 text-sm text-black/55">资料库新增后，付款申请页会直接使用这里的对象和银行信息。</div>
        </div>
        <form action={createPaymentPartyAction} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Field name="name" label="对象名称" placeholder="例如：莫斯科包装供应商C" />
            <SelectField
              name="type"
              label="对象类型"
              options={[
                { value: "supplier", label: "供应商" },
                { value: "customer", label: "客户" },
                { value: "internal", label: "内部组织" },
                { value: "person", label: "个人" }
              ]}
            />
            <Field name="bankName" label="银行名称" placeholder="例如：VTB" />
            <Field name="bankAccount" label="银行账号" placeholder="输入银行账号" />
            <Field name="contactName" label="联系人" placeholder="例如：Irina" />
            <Field name="phone" label="联系电话" placeholder="+7 900 000 0000" />
          </div>
          <div>
            <div className="text-sm font-medium text-black/70">适用组织</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {activeOrganizations.map((organization) => (
                <label key={organization.id} className="inline-flex items-center gap-2 rounded-full border border-line bg-paper px-3 py-2 text-xs text-black/70">
                  <input type="checkbox" name="organizationScope" value={organization.displayName} className="h-4 w-4 rounded border-line" />
                  {organization.displayName}
                </label>
              ))}
            </div>
          </div>
          <button className="rounded-md bg-ink px-5 py-3 text-sm font-medium text-white">新增付款对象</button>
        </form>
      </section>

      <section className="rounded-lg border border-line bg-white">
        <div className="border-b border-line px-6 py-4">
          <div className="text-lg font-semibold">对象清单</div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead className="bg-paper">
              <tr>
                {["对象名称", "类型", "适用组织", "银行", "账号", "联系人", "电话", "状态", "操作"].map((label) => (
                  <th key={label} className="px-6 py-3 font-medium text-black/60">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {parties.map((party) => (
                <tr key={party.id} className="border-t border-line">
                  <td className="px-6 py-4 font-medium">{party.name}</td>
                  <td className="px-6 py-4">{typeLabel[party.type]}</td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-2">
                      {(party.organizationScope ?? []).map((name) => (
                        <span key={name} className="inline-flex rounded-full bg-paper px-3 py-1 text-xs font-medium text-black/70">
                          {name}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4">{party.bankName}</td>
                  <td className="px-6 py-4">{party.bankAccount}</td>
                  <td className="px-6 py-4">{party.contactName}</td>
                  <td className="px-6 py-4">{party.phone}</td>
                  <td className="px-6 py-4">{party.isActive ? "启用" : "停用"}</td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-2">
                      <form action={togglePaymentPartyAction}>
                        <input type="hidden" name="partyId" value={party.id} />
                        <button className="rounded-md border border-line bg-paper px-3 py-2 text-xs font-medium text-ink">
                          {party.isActive ? "停用" : "启用"}
                        </button>
                      </form>
                      {activeOrganizations.map((organization) => {
                        const included = (party.organizationScope ?? []).includes(organization.displayName);
                        return (
                          <form key={organization.id} action={togglePaymentPartyOrganizationScopeAction}>
                            <input type="hidden" name="partyId" value={party.id} />
                            <input type="hidden" name="organizationName" value={organization.displayName} />
                            <button className={`rounded-full px-3 py-2 text-xs font-medium ${included ? "bg-emerald-50 text-emerald-700" : "border border-line bg-paper text-black/60"}`}>
                              {organization.displayName}
                            </button>
                          </form>
                        );
                      })}
                    </div>
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
