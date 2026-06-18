import { toggleRoleApprovalPermissionAction } from "@/app/dashboard/settings/actions";
import { getRoleConfigViewAsync } from "@/lib/demo-store";
import { approvalPermissionLabels, SectionCard } from "../_components";

export default async function AccessApprovalAccessPage() {
  const roles = await getRoleConfigViewAsync();

  return (
    <SectionCard title="审批权限">
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-left text-sm">
          <thead className="bg-paper">
            <tr>
              <th className="px-4 py-3 font-medium text-black/60">角色</th>
              {Object.values(approvalPermissionLabels).map((label) => (
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
                {Object.keys(approvalPermissionLabels).map((key) => (
                  <td key={key} className="px-4 py-4">
                    <form action={toggleRoleApprovalPermissionAction}>
                      <input type="hidden" name="roleId" value={role.id} />
                      <input type="hidden" name="permissionKey" value={key} />
                      <button
                        className={`rounded-full px-3 py-1 text-xs font-medium ${
                          role.approvalPermissions[key as keyof typeof role.approvalPermissions]
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-stone-200 text-stone-700"
                        }`}
                      >
                        {role.approvalPermissions[key as keyof typeof role.approvalPermissions] ? "允许" : "不允许"}
                      </button>
                    </form>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}
