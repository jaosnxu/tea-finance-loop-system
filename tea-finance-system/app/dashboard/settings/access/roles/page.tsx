import { updateRoleDescriptionAction } from "@/app/dashboard/settings/actions";
import { getRoleConfigViewAsync, getUserAccountViewAsync } from "@/lib/demo-store";
import { SectionCard } from "../_components";

export default async function AccessRolesPage() {
  const [roles, users] = await Promise.all([getRoleConfigViewAsync(), getUserAccountViewAsync()]);

  return (
    <SectionCard title="角色管理">
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-left text-sm">
          <thead className="bg-paper">
            <tr>
              {["角色", "说明", "数据范围", "绑定账号数", "页面数"].map((label) => (
                <th key={label} className="px-4 py-3 font-medium text-black/60">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {roles.map((role) => (
              <tr key={role.id} className="border-t border-line align-top">
                <td className="px-4 py-4 font-medium">{role.label}</td>
                <td className="px-4 py-4 text-black/70">
                  <form action={updateRoleDescriptionAction} className="space-y-2">
                    <input type="hidden" name="roleId" value={role.id} />
                    <textarea
                      name="description"
                      defaultValue={role.description}
                      rows={3}
                      className="w-full rounded-md border border-line bg-white px-3 py-2 text-sm outline-none"
                    />
                    <button className="rounded-md border border-line bg-paper px-3 py-2 text-xs font-medium text-ink">
                      保存说明
                    </button>
                  </form>
                </td>
                <td className="px-4 py-4">{role.dataScope}</td>
                <td className="px-4 py-4">{users.filter((item) => item.role === role.id).length}</td>
                <td className="px-4 py-4">{role.pageAccess.length}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}
