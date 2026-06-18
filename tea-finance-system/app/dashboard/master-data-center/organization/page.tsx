import { requirePageAccess } from "@/lib/auth";
import OrganizationSettingsPage from "@/app/dashboard/settings/organization/page";

export default async function MasterDataOrganizationPage() {
  await requirePageAccess("settings_organization");
  return <OrganizationSettingsPage />;
}
