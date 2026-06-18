import { requirePageAccess } from "@/lib/auth";
import ApprovalAccessPage from "@/app/dashboard/settings/access/approval-access/page";

export default async function SystemApprovalAccessPage() {
  await requirePageAccess("settings_access");
  return <ApprovalAccessPage />;
}
