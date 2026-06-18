import { requirePageAccess } from "@/lib/auth";
import PageAccessPage from "@/app/dashboard/settings/access/page-access/page";

export default async function SystemPageAccessPage() {
  await requirePageAccess("settings_access");
  return <PageAccessPage />;
}
