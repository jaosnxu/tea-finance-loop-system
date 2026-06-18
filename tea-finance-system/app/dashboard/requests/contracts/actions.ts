"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { canDoApproval, requirePageAccess } from "@/lib/auth";
import { updateContractApprovalStatus } from "@/lib/demo-store";

export async function transitionContractApprovalAction(formData: FormData) {
  const session = await requirePageAccess("contract_requests");
  const requestId = String(formData.get("requestId") || "");
  const action = String(formData.get("action") || "");
  const note = String(formData.get("note") || "").trim();

  if (action === "approve") {
    if (!canDoApproval(session, "approve")) redirect(`/dashboard/requests/contracts/${requestId}`);
    await updateContractApprovalStatus(requestId, "approve", { actor: session.displayName, note });
  } else if (action === "reject") {
    if (!canDoApproval(session, "reject")) redirect(`/dashboard/requests/contracts/${requestId}`);
    await updateContractApprovalStatus(requestId, "reject", { actor: session.displayName, note });
  } else if (action === "cancel") {
    if (!canDoApproval(session, "cancelOwnRequest")) redirect(`/dashboard/requests/contracts/${requestId}`);
    await updateContractApprovalStatus(requestId, "cancel", { actor: session.displayName, note });
  }

  revalidatePath("/dashboard/approvals");
  revalidatePath("/dashboard/requests/contracts");
  revalidatePath(`/dashboard/requests/contracts/${requestId}`);
  redirect(`/dashboard/requests/contracts/${requestId}`);
}
