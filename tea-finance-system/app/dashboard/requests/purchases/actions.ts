"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { canDoApproval, requirePageAccess } from "@/lib/auth";
import { updatePurchaseRequestStatus } from "@/lib/demo-store";

export async function transitionPurchaseRequestAction(formData: FormData) {
  const session = await requirePageAccess("purchase_requests");
  const requestId = String(formData.get("requestId") || "");
  const action = String(formData.get("action") || "");
  const note = String(formData.get("note") || "").trim();

  if (action === "approve") {
    if (!canDoApproval(session, "approve")) redirect(`/dashboard/requests/purchases/${requestId}`);
    await updatePurchaseRequestStatus(requestId, "approve", { actor: session.displayName, note });
  } else if (action === "reject") {
    if (!canDoApproval(session, "reject")) redirect(`/dashboard/requests/purchases/${requestId}`);
    await updatePurchaseRequestStatus(requestId, "reject", { actor: session.displayName, note });
  } else if (action === "cancel") {
    if (!canDoApproval(session, "cancelOwnRequest")) redirect(`/dashboard/requests/purchases/${requestId}`);
    await updatePurchaseRequestStatus(requestId, "cancel", { actor: session.displayName, note });
  }

  revalidatePath("/dashboard/approvals");
  revalidatePath("/dashboard/requests/purchases");
  revalidatePath(`/dashboard/requests/purchases/${requestId}`);
  redirect(`/dashboard/requests/purchases/${requestId}`);
}
