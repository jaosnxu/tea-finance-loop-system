import { toggleUserOrganizationScopeAction } from "@/app/dashboard/settings/actions";
import { getOrganizationConfigViewAsync, getRoleConfigViewAsync, getUserAccountViewAsync } from "@/lib/demo-store";
import { RoleBadge, SectionCard, UserStatusBadge } from "../_components";

export default async function AccessOrganizationAccessPage() {
  const [organizations, roles, users] = await Promise.all([
    getOrganizationConfigViewAsync(),
    getRoleConfigViewAsync(),
    getUserAccountViewAsync()
  ]);
  const activeOrganizations = organizations.filter((item) => item.isActive);

  return (
    <SectionCard title="组织访问范围">
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-left text-sm">
          <thead className="bg-paper">
            <tr>
              {["账号", "角色", "可见组织", "状态"].map((label) => (
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
                  <td className="px-4 py-4">
                    <div className="font-medium">{user.displayName}</div>
                    <div className="mt-1 text-xs text-black/55">{user.username}</div>
                  </td>
                  <td className="px-4 py-4">
                    <RoleBadge role={role} />
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex flex-wrap gap-2">
                      {activeOrganizations.map((organization) => {
                        const enabled = user.organizationScope.includes(organization.displayName);
                        return (
                          <form key={organization.id} action={toggleUserOrganizationScopeAction}>
                            <input type="hidden" name="userId" value={user.id} />
                            <input type="hidden" name="organizationName" value={organization.displayName} />
                            <button
                              className={`rounded-full border px-3 py-1 text-xs ${
                                enabled ? "border-ink bg-ink text-white" : "border-line bg-paper text-ink"
                              }`}
                            >
                              {organization.displayName}
                            </button>
                          </form>
                        );
                      })}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <UserStatusBadge user={user} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}
