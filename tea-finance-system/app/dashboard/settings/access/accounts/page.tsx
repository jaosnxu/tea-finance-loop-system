import {
  createUserAccountAction,
  resetUserAccountPasswordAction,
  toggleUserAccountAction,
  updateUserAccountRoleAction
} from "@/app/dashboard/settings/actions";
import { getOrganizationConfigViewAsync, getRoleConfigViewAsync, getUserAccountViewAsync } from "@/lib/demo-store";
import { RoleBadge, SectionCard, UserStatusBadge } from "../_components";

export default async function AccessAccountsPage() {
  const [organizations, roles, users] = await Promise.all([
    getOrganizationConfigViewAsync(),
    getRoleConfigViewAsync(),
    getUserAccountViewAsync()
  ]);
  const activeOrganizations = organizations.filter((item) => item.isActive);

  return (
    <div className="space-y-4">
      <SectionCard title="新增账号">
        <form action={createUserAccountAction} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Field name="displayName" label="显示名" placeholder="例如：Anna" />
            <Field name="username" label="用户名" placeholder="例如：anna" />
            <Field name="password" label="登录密码" placeholder="例如：anna2026" />
            <SelectField
              name="role"
              label="角色"
              options={roles.map((item) => ({ value: item.id, label: item.label }))}
            />
          </div>
          <div>
            <div className="text-sm font-medium text-black/70">组织范围</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {activeOrganizations.map((organization) => (
                <label
                  key={organization.id}
                  className="inline-flex items-center gap-2 rounded-full border border-line bg-paper px-3 py-2 text-xs text-black/70"
                >
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
          <button className="rounded-md bg-ink px-5 py-3 text-sm font-medium text-white">新增账号</button>
        </form>
      </SectionCard>

      <SectionCard title="账号列表">
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead className="bg-paper">
              <tr>
                {["显示名", "用户名", "角色", "组织范围", "状态", "操作"].map((label) => (
                  <th key={label} className="px-4 py-3 font-medium text-black/60">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const role = roles.find((item) => item.id === user.role);
                return (
                  <tr key={user.id} className="border-t border-line">
                    <td className="px-4 py-4 font-medium">{user.displayName}</td>
                    <td className="px-4 py-4">{user.username}</td>
                    <td className="px-4 py-4">
                      <div className="space-y-2">
                        <RoleBadge role={role} />
                        <form action={updateUserAccountRoleAction} className="flex gap-2">
                          <input type="hidden" name="userId" value={user.id} />
                          <select
                            name="role"
                            defaultValue={user.role}
                            className="h-9 rounded-md border border-line bg-white px-3 text-xs"
                          >
                            {roles.map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.label}
                              </option>
                            ))}
                          </select>
                          <button className="rounded-md border border-line bg-paper px-3 py-2 text-xs font-medium text-ink">
                            保存
                          </button>
                        </form>
                      </div>
                    </td>
                    <td className="px-4 py-4">{user.organizationScope.join(" / ")}</td>
                    <td className="px-4 py-4">
                      <UserStatusBadge user={user} />
                    </td>
                    <td className="px-4 py-4">
                      <div className="space-y-2">
                        <form action={toggleUserAccountAction}>
                          <input type="hidden" name="userId" value={user.id} />
                          <button className="rounded-md border border-line bg-paper px-3 py-2 text-xs font-medium text-ink">
                            {user.isActive ? "停用" : "启用"}
                          </button>
                        </form>
                        <form action={resetUserAccountPasswordAction} className="flex gap-2">
                          <input type="hidden" name="userId" value={user.id} />
                          <input
                            name="password"
                            required
                            placeholder="重置密码"
                            className="h-9 rounded-md border border-line bg-white px-3 text-xs"
                          />
                          <button className="rounded-md border border-line bg-paper px-3 py-2 text-xs font-medium text-ink">
                            重置
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
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
        className="mt-2 h-11 w-full rounded-md border border-line bg-white px-4 text-sm outline-none"
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
