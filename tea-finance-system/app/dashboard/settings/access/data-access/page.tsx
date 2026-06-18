import { updateRoleDataScopeAction } from "@/app/dashboard/settings/actions";
import { getRoleConfigViewAsync } from "@/lib/demo-store";
import { SectionCard } from "../_components";

const dataScopeLabels = {
  all: "全部数据",
  organization: "所属组织数据",
  own: "本人相关数据"
} as const;

export default async function AccessDataAccessPage() {
  const roles = await getRoleConfigViewAsync();

  return (
    <SectionCard title="数据权限">
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-left text-sm">
          <thead className="bg-paper">
            <tr>
              {["角色", "数据范围"].map((label) => (
                <th key={label} className="px-4 py-3 font-medium text-black/60">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {roles.map((role) => (
              <tr key={role.id} className="border-t border-line">
                <td className="px-4 py-4 font-medium">{role.label}</td>
                <td className="px-4 py-4">
                  <form action={updateRoleDataScopeAction} className="flex gap-2">
                    <input type="hidden" name="roleId" value={role.id} />
                    <select
                      name="dataScope"
                      defaultValue={role.dataScope}
                      className="h-9 rounded-md border border-line bg-white px-3 text-sm"
                    >
                      <option value="all">{dataScopeLabels.all}</option>
                      <option value="organization">{dataScopeLabels.organization}</option>
                      <option value="own">{dataScopeLabels.own}</option>
                    </select>
                    <button className="rounded-md border border-line bg-paper px-3 py-2 text-xs font-medium text-ink">
                      保存
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}
