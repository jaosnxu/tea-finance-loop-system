import { redirect } from "next/navigation";
import { requirePageAccess } from "@/lib/auth";

export default async function SystemCenterPage() {
  await requirePageAccess("system_center");
  redirect("/dashboard/system-center/accounts");
}
