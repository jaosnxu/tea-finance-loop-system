import { createBankAccountAction, setDefaultBankAccountAction, toggleBankAccountAction } from "@/app/dashboard/settings/actions";
import {
  formatMoney,
  getBankAccountConfigViewAsync,
  getBankAccountReportRowsAsync,
  getBankAccountSummaryAsync,
  getOrganizationConfigViewAsync
} from "@/lib/demo-store";

export default async function BankAccountsSettingsPage() {
  const [accounts, groupedRows, metrics, organizations] = await Promise.all([
    getBankAccountConfigViewAsync(),
    getBankAccountReportRowsAsync(),
    getBankAccountSummaryAsync(),
    getOrganizationConfigViewAsync()
  ]);
  const activeOrganizations = organizations.filter((item) => item.isActive);

  return (
    <main className="space-y-6">
      <header className="rounded-lg border border-line bg-white p-6">
        <div className="text-sm uppercase tracking-[0.18em] text-bronze">bank account settings</div>
        <h1 className="mt-2 text-3xl font-semibold">银行账户配置</h1>
        <p className="mt-3 max-w-4xl text-sm leading-6 text-black/65">
          这里统一管理各组织付款账户、默认账户和余额口径。
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "账户总数", value: metrics.totalAccounts },
          { label: "启用账户", value: metrics.activeAccounts },
          { label: "RUB 账户", value: metrics.rubAccounts },
          { label: "默认账户", value: metrics.defaultAccounts }
        ].map((item) => (
          <div key={item.label} className="rounded-lg border border-line bg-white p-5">
            <div className="text-sm text-black/55">{item.label}</div>
            <div className="mt-3 text-2xl font-semibold">{item.value}</div>
          </div>
        ))}
      </section>

      <section className="rounded-lg border border-line bg-white p-6">
        <div className="mb-4">
          <div className="text-lg font-semibold">新增账户</div>
          <div className="mt-1 text-sm text-black/55">付款执行直接使用这里的账户主数据和默认策略。</div>
        </div>
        <form action={createBankAccountAction} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <SelectField
              name="organization"
              label="所属组织"
              options={activeOrganizations.map((item) => ({ value: item.displayName, label: item.displayName }))}
            />
            <Field name="accountName" label="账户名称" placeholder="例如：品牌管理公司 - USD 账户" />
            <Field name="bankName" label="银行名称" placeholder="例如：Sberbank" />
            <Field name="accountNumber" label="银行账号" placeholder="输入银行账号" />
            <SelectField
              name="currency"
              label="币种"
              options={[
                { value: "RUB", label: "RUB" },
                { value: "CNY", label: "CNY" },
                { value: "USD", label: "USD" }
              ]}
            />
            <Field name="balance" label="账户余额" placeholder="0" type="number" />
          </div>
          <label className="flex items-center gap-2 text-sm text-black/70">
            <input type="checkbox" name="isDefault" value="true" className="h-4 w-4 rounded border-line" />
            设为该组织该币种默认账户
          </label>
          <button className="rounded-md bg-ink px-5 py-3 text-sm font-medium text-white">新增账户</button>
        </form>
      </section>

      <section className="rounded-lg border border-line bg-white">
        <div className="border-b border-line px-6 py-4">
          <div className="text-lg font-semibold">默认账户策略视图</div>
          <div className="mt-1 text-sm text-black/55">按组织 + 币种看默认付款账户，发起页和财务执行页都会走这里的规则。</div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead className="bg-paper">
              <tr>
                {["组织", "币种", "默认账户", "开户行", "启用账户数", "总余额"].map((label) => (
                  <th key={label} className="px-6 py-3 font-medium text-black/60">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {groupedRows.map((row) => (
                <tr key={row.id} className="border-t border-line">
                  <td className="px-6 py-4 font-medium">{row.organization}</td>
                  <td className="px-6 py-4">{row.currency}</td>
                  <td className="px-6 py-4">{row.defaultAccountName}</td>
                  <td className="px-6 py-4">{row.defaultBankName}</td>
                  <td className="px-6 py-4">{row.activeAccountCount}</td>
                  <td className="px-6 py-4">{formatMoney(row.totalBalance, row.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border border-line bg-white">
        <div className="border-b border-line px-6 py-4">
          <div className="text-lg font-semibold">账户清单</div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead className="bg-paper">
              <tr>
                {["所属组织", "账户名称", "银行", "账号", "币种", "余额", "默认", "状态", "操作"].map((label) => (
                  <th key={label} className="px-6 py-3 font-medium text-black/60">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {accounts.map((account) => (
                <tr key={account.id} className="border-t border-line">
                  <td className="px-6 py-4">{account.organization}</td>
                  <td className="px-6 py-4 font-medium">{account.accountName}</td>
                  <td className="px-6 py-4">{account.bankName}</td>
                  <td className="px-6 py-4">{account.accountNumber}</td>
                  <td className="px-6 py-4">{account.currency}</td>
                  <td className="px-6 py-4">{formatMoney(account.balance, account.currency)}</td>
                  <td className="px-6 py-4">{account.isDefault ? "是" : "否"}</td>
                  <td className="px-6 py-4">{account.isActive ? "启用" : "停用"}</td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-2">
                      <form action={toggleBankAccountAction}>
                        <input type="hidden" name="accountId" value={account.id} />
                        <button className="rounded-md border border-line bg-paper px-3 py-2 text-xs font-medium text-ink">
                          {account.isActive ? "停用" : "启用"}
                        </button>
                      </form>
                      {!account.isDefault && account.isActive ? (
                        <form action={setDefaultBankAccountAction}>
                          <input type="hidden" name="accountId" value={account.id} />
                          <button className="rounded-md border border-line bg-paper px-3 py-2 text-xs font-medium text-ink">设默认</button>
                        </form>
                      ) : null}
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
        <option value="">请选择</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
