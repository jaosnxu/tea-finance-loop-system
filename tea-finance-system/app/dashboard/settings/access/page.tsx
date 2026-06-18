import { redirect } from "next/navigation";

export default function AccessSettingsPage() {
  redirect("/dashboard/settings/access/accounts");
}
