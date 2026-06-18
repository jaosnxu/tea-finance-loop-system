import { requirePageAccess } from "@/lib/auth";
import RolesPage from "@/app/dashboard/settings/access/roles/page";

export default async function SystemRolesPage() {
  await requirePageAccess("settings_access");
  return <RolesPage />;
}
