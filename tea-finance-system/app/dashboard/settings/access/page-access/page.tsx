import { toggleRolePageAccessAction } from "@/app/dashboard/settings/actions";
import { getRoleConfigViewAsync } from "@/lib/demo-store";
import { pageAccessLabels, SectionCard } from "../_components";

export default async function AccessPageAccessPage() {
  const roles = await getRoleConfigViewAsync();

  return (
    <SectionCard title="页面权限">
      <div className="space-y-4">
        {roles.map((role) => (
          <div key={role.id} className="rounded-lg border border-line p-4">
            <div className="mb-3 text-base font-semibold">{role.label}</div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(pageAccessLabels).map(([pageKey, label]) => (
                <form key={pageKey} action={toggleRolePageAccessAction}>
                  <input type="hidden" name="roleId" value={role.id} />
                  <input type="hidden" name="pageAccess" value={pageKey} />
                  <button
                    className={`rounded-full border px-3 py-1 text-xs ${
                      role.pageAccess.includes(pageKey as keyof typeof pageAccessLabels)
                        ? "border-ink bg-ink text-white"
                        : "border-line bg-paper text-ink"
                    }`}
                  >
                    {label}
                  </button>
                </form>
              ))}
            </div>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}
