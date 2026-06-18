import { requirePageAccess } from "@/lib/auth";
import FlowSettingsPage from "@/app/dashboard/settings/flows/page";

export default async function RulesFlowsPage() {
  await requirePageAccess("settings_flows");
  return <FlowSettingsPage />;
}
