import { requirePageAccess } from "@/lib/auth";
import PaymentPartiesPage from "@/app/dashboard/settings/payment-parties/page";

export default async function MasterDataPaymentPartiesPage() {
  await requirePageAccess("settings_payment_parties");
  return <PaymentPartiesPage />;
}
