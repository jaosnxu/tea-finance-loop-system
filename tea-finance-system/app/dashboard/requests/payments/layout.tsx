import { requirePageAccess } from "@/lib/auth";

export default async function PaymentRequestsLayout({
  children
}: {
  children: React.ReactNode;
}) {
  await requirePageAccess("payment_requests");
  return children;
}
