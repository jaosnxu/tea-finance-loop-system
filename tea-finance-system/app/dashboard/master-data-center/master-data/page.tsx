import { requirePageAccess } from "@/lib/auth";
import MasterDataSettingsPage from "@/app/dashboard/settings/master-data/page";

export default async function MasterDataPage() {
  await requirePageAccess("settings_master_data");
  return <MasterDataSettingsPage />;
}
