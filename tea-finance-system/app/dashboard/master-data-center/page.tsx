import { redirect } from "next/navigation";
import { requirePageAccess } from "@/lib/auth";

export default async function MasterDataCenterPage() {
  await requirePageAccess("master_data_center");
  redirect("/dashboard/master-data-center/organization");
}
