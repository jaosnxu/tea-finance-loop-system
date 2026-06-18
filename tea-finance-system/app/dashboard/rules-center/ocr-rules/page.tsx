import { requirePageAccess } from "@/lib/auth";
import OcrRulesPage from "@/app/dashboard/settings/ocr-rules/page";

export default async function RulesOcrRulesPage() {
  await requirePageAccess("settings_ocr_rules");
  return <OcrRulesPage />;
}
