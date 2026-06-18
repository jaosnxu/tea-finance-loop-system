import { toggleFlowOrganizationScopeAction, toggleFlowTemplateAction } from "@/app/dashboard/settings/actions";
import {
  getApprovalFlowSummaryAsync,
  getApprovalFlowTemplatesViewAsync,
  getOrganizationConfigViewAsync
} from "@/lib/demo-store";

const approverTypeLabel = {
  role: "角色",
  person: "指定人员",
  manager: "发起人上级"
} as const;

export default async function FlowSettingsPage() {
  const [metrics, organizations, flowTemplates] = await Promise.all([
    getApprovalFlowSummaryAsync(),
    getOrganizationConfigViewAsync(),
    getApprovalFlowTemplatesViewAsync()
  ]);

  return (
    <main className="space-y-6">
      <header className="rounded-lg border border-line bg-white p-6">
        <div className="text-sm uppercase tracking-[0.18em] text-bronze">flow settings</div>
        <h1 className="mt-2 text-3xl font-semibold">审批流配置</h1>
        <p className="mt-3 max-w-4xl text-sm leading-6 text-black/65">
          这里统一管理流程模板、适用组织、节点顺序、角色和通过动作。
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "流程模板总数", value: metrics.totalTemplates },
          { label: "启用模板", value: metrics.activeTemplates },
          { label: "付款审批模板", value: metrics.paymentTemplates },
          { label: "覆盖组织", value: metrics.coveredOrganizations }
        ].map((item) => (
          <div key={item.label} className="rounded-lg border border-line bg-white p-5">
            <div className="text-sm text-black/55">{item.label}</div>
            <div className="mt-3 text-2xl font-semibold">{item.value}</div>
          </div>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        {flowTemplates.map((template) => (
          <div key={template.id} className="rounded-lg border border-line bg-white">
            <div className="border-b border-line px-6 py-4">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-lg font-semibold">{template.name}</h2>
                <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${template.enabled ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-700"}`}>
                  {template.enabled ? "启用中" : "停用"}
                </span>
                <form action={toggleFlowTemplateAction}>
                  <input type="hidden" name="templateId" value={template.id} />
                  <button className="rounded-md border border-line bg-paper px-3 py-2 text-xs font-medium text-ink">
                    {template.enabled ? "停用流程" : "启用流程"}
                  </button>
                </form>
              </div>
              <p className="mt-2 text-sm text-black/55">
                适用组织：{template.organizationScope.join(" / ")} | 币种：{template.currencyScope.join(" / ")} | 规则：{template.amountRule}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {organizations.map((organization) => {
                  const included = template.organizationScope.includes(organization.displayName);
                  return (
                    <form key={organization.id} action={toggleFlowOrganizationScopeAction}>
                      <input type="hidden" name="templateId" value={template.id} />
                      <input type="hidden" name="organizationName" value={organization.displayName} />
                      <button
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                          included
                            ? organization.isActive
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-amber-50 text-amber-700"
                            : "bg-paper text-black/60 border border-line"
                        }`}
                      >
                        {organization.displayName} / {organization.taxLabel} / {included ? "适用" : "未适用"}
                      </button>
                    </form>
                  );
                })}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-left text-sm">
                <thead className="bg-paper">
                  <tr>
                    {["顺序", "节点名称", "审批人来源", "审批对象", "抄送", "通过后动作"].map((label) => (
                      <th key={label} className="px-6 py-3 font-medium text-black/60">
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {template.nodes.map((node) => (
                    <tr key={node.id} className="border-t border-line align-top">
                      <td className="px-6 py-4">{node.order}</td>
                      <td className="px-6 py-4 font-medium">{node.name}</td>
                      <td className="px-6 py-4">{approverTypeLabel[node.approverType]}</td>
                      <td className="px-6 py-4">{node.approverValue}</td>
                      <td className="px-6 py-4">{node.ccList.length > 0 ? node.ccList.join(" / ") : "-"}</td>
                      <td className="px-6 py-4">{node.actionOnPass}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </section>

      <section className="rounded-lg border border-line bg-white p-6">
        <h2 className="text-lg font-semibold">配置原则</h2>
        <ul className="mt-4 space-y-3 text-sm leading-6 text-black/65">
          <li>流程模板按组织、请求类型、币种范围配置，不写死到代码逻辑里。</li>
          <li>审批节点支持角色、指定人员、发起人上级三种来源。</li>
          <li>审批通过后的动作直接影响付款主闭环状态流转。</li>
          <li>流程规则优先在这里调整，不直接改页面逻辑。</li>
        </ul>
      </section>
    </main>
  );
}
