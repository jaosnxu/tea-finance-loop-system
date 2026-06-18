import { requirePageAccess } from "@/lib/auth";
import AccountsPage from "@/app/dashboard/settings/access/accounts/page";

export default async function SystemAccountsPage() {
  await requirePageAccess("settings_access");
  return <AccountsPage />;
}
