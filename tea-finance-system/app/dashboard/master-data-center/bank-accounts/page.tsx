import { requirePageAccess } from "@/lib/auth";
import BankAccountsPage from "@/app/dashboard/settings/bank-accounts/page";

export default async function MasterDataBankAccountsPage() {
  await requirePageAccess("settings_bank_accounts");
  return <BankAccountsPage />;
}
