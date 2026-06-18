import { redirect } from "next/navigation";
import { requirePageAccess } from "@/lib/auth";

export default async function RulesCenterPage() {
  await requirePageAccess("rules_center");
  redirect("/dashboard/rules-center/flows");
}
