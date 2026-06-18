import {
  createDepartmentAction,
  createPersonAction,
  createProjectAction,
  toggleDepartmentAction,
  togglePersonAction,
  toggleProjectAction
} from "@/app/dashboard/settings/actions";
import { requirePageAccess } from "@/lib/auth";
import {
  getDepartmentConfigViewAsync,
  getMasterDataSummaryAsync,
  getOrganizationConfigViewAsync,
  getPersonConfigViewAsync,
  getProjectConfigViewAsync
} from "@/lib/demo-store";

export default async function MasterDataSettingsPage() {
  await requirePageAccess("settings_master_data");
  const [summary, organizations, departments, persons, projects] = await Promise.all([
    getMasterDataSummaryAsync(),
    getOrganizationConfigViewAsync(),
    getDepartmentConfigViewAsync(),
    getPersonConfigViewAsync(),
    getProjectConfigViewAsync()
  ]);

  const activeOrganizations = organizations.filter((item) => item.isActive);
  const activePersons = persons.filter((item) => item.isActive);
  const departmentNameById = new Map(departments.map((item) => [item.id, item.name]));
  const personNameById = new Map(persons.map((item) => [item.id, item.displayName]));

  return (
    <main className="space-y-6">
      <header className="rounded-lg border border-line bg-white p-6">
        <div className="text-sm uppercase tracking-[0.18em] text-bronze">master data</div>
        <h1 className="mt-2 text-3xl font-semibold">主数据体系</h1>
        <p className="mt-3 max-w-4xl text-sm leading-6 text-black/65">
          这里统一管理部门、人员、项目/门店和上下级关系。审批、申请、权限和统计都以这里为准。
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "启用组织", value: summary.organizations },
          { label: "启用部门", value: summary.departments },
          { label: "启用人员", value: summary.persons },
          { label: "启用项目/门店", value: summary.projects }
        ].map((item) => (
          <div key={item.label} className="rounded-lg border border-line bg-white p-5">
            <div className="text-sm text-black/55">{item.label}</div>
            <div className="mt-3 text-2xl font-semibold">{item.value}</div>
          </div>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-3">
        <Panel
          title="新增部门"
          description="部门挂在组织下，可配置上级部门和部门负责人。"
          form={
            <form action={createDepartmentAction} className="space-y-4">
              <Field name="name" label="部门名称" placeholder="例如：门店运营部" />
              <SelectField
                name="organization"
                label="所属组织"
                options={activeOrganizations.map((item) => ({ value: item.displayName, label: item.displayName }))}
              />
              <SelectField
                name="parentDepartmentId"
                label="上级部门"
                allowEmpty
                options={departments.map((item) => ({ value: item.id, label: `${item.organization} / ${item.name}` }))}
              />
              <SelectField
                name="managerPersonId"
                label="部门负责人"
                allowEmpty
                options={activePersons.map((item) => ({ value: item.id, label: `${item.displayName} / ${item.title}` }))}
              />
              <Submit label="新增部门" />
            </form>
          }
        />

        <Panel
          title="新增项目 / 门店"
          description="项目和门店统一作为项目主数据维护，付款申请直接引用。"
          form={
            <form action={createProjectAction} className="space-y-4">
              <Field name="name" label="名称" placeholder="例如：喀山二店" />
              <Field name="code" label="编码" placeholder="例如：KZN-02" />
              <SelectField
                name="organization"
                label="所属组织"
                options={activeOrganizations.map((item) => ({ value: item.displayName, label: item.displayName }))}
              />
              <SelectField
                name="type"
                label="类型"
                options={[
                  { value: "store", label: "门店" },
                  { value: "project", label: "项目" },
                  { value: "shared", label: "公共项目" }
                ]}
              />
              <SelectField
                name="managerPersonId"
                label="负责人"
                allowEmpty
                options={activePersons.map((item) => ({ value: item.id, label: `${item.displayName} / ${item.title}` }))}
              />
              <Submit label="新增项目/门店" />
            </form>
          }
        />

        <Panel
          title="新增人员"
          description="人员记录组织、部门、职位和直接上级，后续审批上级链从这里取。"
          form={
            <form action={createPersonAction} className="space-y-4">
              <Field name="displayName" label="人员姓名" placeholder="例如：Ivan" />
              <Field name="title" label="职位" placeholder="例如：门店主管" />
              <Field name="phone" label="电话" placeholder="+7 ..." />
              <Field name="email" label="邮箱" placeholder="name@tea.local" />
              <SelectField
                name="organization"
                label="所属组织"
                options={activeOrganizations.map((item) => ({ value: item.displayName, label: item.displayName }))}
              />
              <SelectField
                name="departmentId"
                label="所属部门"
                allowEmpty
                options={departments.filter((item) => item.isActive).map((item) => ({ value: item.id, label: `${item.organization} / ${item.name}` }))}
              />
              <SelectField
                name="managerPersonId"
                label="直接上级"
                allowEmpty
                options={activePersons.map((item) => ({ value: item.id, label: `${item.displayName} / ${item.title}` }))}
              />
              <Submit label="新增人员" />
            </form>
          }
        />
      </section>

      <section className="rounded-lg border border-line bg-white">
        <div className="border-b border-line px-6 py-4">
          <h2 className="text-lg font-semibold">部门主数据</h2>
        </div>
        <Table
          headers={["部门", "所属组织", "上级部门", "负责人", "状态", "操作"]}
          rows={departments.map((item) => [
            item.name,
            item.organization,
            item.parentDepartmentId ? departmentNameById.get(item.parentDepartmentId) ?? "-" : "-",
            item.managerPersonId ? personNameById.get(item.managerPersonId) ?? "-" : "-",
            item.isActive ? "启用" : "停用",
            <form key={item.id} action={toggleDepartmentAction}>
              <input type="hidden" name="departmentId" value={item.id} />
              <button className="rounded-md border border-line bg-paper px-3 py-2 text-xs font-medium text-ink">
                {item.isActive ? "停用" : "启用"}
              </button>
            </form>
          ])}
        />
      </section>

      <section className="rounded-lg border border-line bg-white">
        <div className="border-b border-line px-6 py-4">
          <h2 className="text-lg font-semibold">项目 / 门店主数据</h2>
        </div>
        <Table
          headers={["名称", "编码", "所属组织", "类型", "负责人", "状态", "操作"]}
          rows={projects.map((item) => [
            item.name,
            item.code,
            item.organization,
            item.type,
            item.managerPersonId ? personNameById.get(item.managerPersonId) ?? "-" : "-",
            item.isActive ? "启用" : "停用",
            <form key={item.id} action={toggleProjectAction}>
              <input type="hidden" name="projectId" value={item.id} />
              <button className="rounded-md border border-line bg-paper px-3 py-2 text-xs font-medium text-ink">
                {item.isActive ? "停用" : "启用"}
              </button>
            </form>
          ])}
        />
      </section>

      <section className="rounded-lg border border-line bg-white">
        <div className="border-b border-line px-6 py-4">
          <h2 className="text-lg font-semibold">人员与上下级关系</h2>
        </div>
        <Table
          headers={["姓名", "组织", "部门", "职位", "直接上级", "联系方式", "状态", "操作"]}
          rows={persons.map((item) => [
            item.displayName,
            item.organization,
            item.departmentId ? departmentNameById.get(item.departmentId) ?? "-" : "-",
            item.title,
            item.managerPersonId ? personNameById.get(item.managerPersonId) ?? "-" : "-",
            `${item.phone} / ${item.email}`,
            item.isActive ? "启用" : "停用",
            <form key={item.id} action={togglePersonAction}>
              <input type="hidden" name="personId" value={item.id} />
              <button className="rounded-md border border-line bg-paper px-3 py-2 text-xs font-medium text-ink">
                {item.isActive ? "停用" : "启用"}
              </button>
            </form>
          ])}
        />
      </section>
    </main>
  );
}

function Panel({
  title,
  description,
  form
}: {
  title: string;
  description: string;
  form: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-line bg-white p-6">
      <div className="mb-4">
        <div className="text-lg font-semibold">{title}</div>
        <div className="mt-1 text-sm text-black/55">{description}</div>
      </div>
      {form}
    </section>
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
  options,
  allowEmpty = false
}: {
  name: string;
  label: string;
  options: Array<{ value: string; label: string }>;
  allowEmpty?: boolean;
}) {
  return (
    <div>
      <div className="text-sm font-medium text-black/70">{label}</div>
      <select name={name} required={!allowEmpty} className="mt-2 h-11 w-full rounded-md border border-line bg-white px-4 text-sm outline-none">
        {allowEmpty ? <option value="">不设置</option> : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function Submit({ label }: { label: string }) {
  return <button className="rounded-md bg-ink px-5 py-3 text-sm font-medium text-white">{label}</button>;
}

function Table({
  headers,
  rows
}: {
  headers: string[];
  rows: Array<Array<React.ReactNode>>;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-collapse text-left text-sm">
        <thead className="bg-paper">
          <tr>
            {headers.map((header) => (
              <th key={header} className="px-6 py-3 font-medium text-black/60">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="border-t border-line align-top">
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="px-6 py-4 text-black/75">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
