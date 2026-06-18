import { redirect } from "next/navigation";
import { requirePageAccess } from "@/lib/auth";

export default async function BusinessCenterPage() {
  await requirePageAccess("business_center");
  redirect("/dashboard/requests/payments");
}
