import { requirePageAccess } from "@/lib/auth";
import LedgerMappingsPage from "@/app/dashboard/settings/ledger-mappings/page";

export default async function RulesLedgerMappingsPage() {
  await requirePageAccess("settings_ledger_mappings");
  return <LedgerMappingsPage />;
}
