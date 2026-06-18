import { requirePageAccess } from "@/lib/auth";

export default async function SettingsLayout({
  children
}: {
  children: React.ReactNode;
}) {
  await requirePageAccess("settings");
  return children;
}
