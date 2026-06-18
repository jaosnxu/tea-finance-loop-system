import { requirePageAccess } from "@/lib/auth";
import OrganizationAccessPage from "@/app/dashboard/settings/access/organization-access/page";

export default async function SystemOrganizationAccessPage() {
  await requirePageAccess("settings_access");
  return <OrganizationAccessPage />;
}
