import { requirePageAccess } from "@/lib/auth";
import ConfigAccessPage from "@/app/dashboard/settings/access/config-access/page";

export default async function SystemConfigAccessPage() {
  await requirePageAccess("settings_access");
  return <ConfigAccessPage />;
}
