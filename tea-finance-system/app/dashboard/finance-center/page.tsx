import { redirect } from "next/navigation";
import { requirePageAccess } from "@/lib/auth";

export default async function FinanceCenterPage() {
  await requirePageAccess("finance_center");
  redirect("/dashboard/execution");
}
