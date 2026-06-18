import { requirePageAccess } from "@/lib/auth";
import FormsPage from "@/app/dashboard/settings/forms/page";

export default async function RulesFormsPage() {
  await requirePageAccess("settings_forms");
  return <FormsPage />;
}
