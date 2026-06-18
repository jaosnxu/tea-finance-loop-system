import { requirePageAccess } from "@/lib/auth";
import DataAccessPage from "@/app/dashboard/settings/access/data-access/page";

export default async function SystemDataAccessPage() {
  await requirePageAccess("settings_access");
  return <DataAccessPage />;
}
