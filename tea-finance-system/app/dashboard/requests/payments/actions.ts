"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { canDoApproval, requirePageAccess } from "@/lib/auth";
import { canAccessOrganization } from "@/lib/access";
import {
  addPaymentExecution,
  createPaymentRequest,
  getBankAccountConfigViewAsync,
  getPaymentPartyConfigViewAsync,
  updatePaymentExecutionVerification,
  updatePaymentRequestDraft,
  updatePaymentRequestStatus
} from "@/lib/demo-store";
import type { PaymentRequestRecord } from "@/lib/mock-data";

function toPartyType(value: string): PaymentRequestRecord["paymentPartyType"] {
  if (value === "customer" || value === "internal" || value === "person") {
    return value;
  }
  return "supplier";
}

function toCurrency(value: string): PaymentRequestRecord["currency"] {
  if (value === "CNY" || value === "USD") {
    return value;
  }
  return "RUB";
}

async function resolvePaymentParty(formData: FormData) {
  const partyName = String(formData.get("paymentPartyName") || "").trim();
  const libraryParty = (await getPaymentPartyConfigViewAsync()).find((item) => item.isActive && item.name === partyName);
  return {
    paymentPartyType: libraryParty?.type ?? toPartyType(String(formData.get("paymentPartyType") || "supplier")),
    paymentPartyName: partyName,
    paymentPartyBank: libraryParty?.bankName ?? String(formData.get("paymentPartyBank") || "").trim(),
    paymentPartyAccount: libraryParty?.bankAccount ?? String(formData.get("paymentPartyAccount") || "").trim()
  };
}

export async function submitPaymentRequestAction(formData: FormData) {
  const session = await requirePageAccess("payment_requests");
  const submitMode = String(formData.get("submitMode") || "draft");
  const party = await resolvePaymentParty(formData);
  const organization = String(formData.get("organization") || "").trim();
  if (!canAccessOrganization(session, organization)) {
    redirect("/dashboard/requests/payments");
  }
  const created = await createPaymentRequest({
    title: String(formData.get("title") || "").trim(),
    applicantName: session.displayName,
    organization,
    projectName: String(formData.get("projectName") || "").trim() || null,
    paymentPartyType: party.paymentPartyType,
    paymentPartyName: party.paymentPartyName,
    paymentPartyBank: party.paymentPartyBank,
    paymentPartyAccount: party.paymentPartyAccount,
    currency: toCurrency(String(formData.get("currency") || "RUB")),
    amount: Number(formData.get("amount") || 0),
    purpose: String(formData.get("purpose") || "").trim(),
    isInternal: String(formData.get("isInternal") || "false") === "true",
    internalTarget: String(formData.get("internalTarget") || "").trim() || null,
    submit: submitMode === "submit"
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/ocr");
  revalidatePath("/dashboard/requests/payments");
  revalidatePath("/dashboard/reports");
  revalidatePath("/dashboard/ledger");
  redirect(`/dashboard/requests/payments/${created.id}`);
}

export async function updatePaymentRequestDraftAction(formData: FormData) {
  const session = await requirePageAccess("payment_requests");
  const requestId = String(formData.get("requestId") || "");
  const submitMode = String(formData.get("submitMode") || "draft");
  const party = await resolvePaymentParty(formData);
  const organization = String(formData.get("organization") || "").trim();
  if (!canAccessOrganization(session, organization)) {
    redirect("/dashboard/requests/payments");
  }
  const updated = await updatePaymentRequestDraft(requestId, {
    title: String(formData.get("title") || "").trim(),
    applicantName: session.displayName,
    organization,
    projectName: String(formData.get("projectName") || "").trim() || null,
    paymentPartyType: party.paymentPartyType,
    paymentPartyName: party.paymentPartyName,
    paymentPartyBank: party.paymentPartyBank,
    paymentPartyAccount: party.paymentPartyAccount,
    currency: toCurrency(String(formData.get("currency") || "RUB")),
    amount: Number(formData.get("amount") || 0),
    purpose: String(formData.get("purpose") || "").trim(),
    isInternal: String(formData.get("isInternal") || "false") === "true",
    internalTarget: String(formData.get("internalTarget") || "").trim() || null,
    submit: submitMode === "submit"
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/ocr");
  revalidatePath("/dashboard/requests/payments");
  revalidatePath(`/dashboard/requests/payments/${requestId}`);
  revalidatePath(`/dashboard/requests/payments/${requestId}/edit`);
  revalidatePath("/dashboard/reports");
  revalidatePath("/dashboard/ledger");
  redirect(`/dashboard/requests/payments/${updated.id}`);
}

export async function transitionPaymentRequestAction(formData: FormData) {
  const session = await requirePageAccess("payment_requests");
  const requestId = String(formData.get("requestId") || "");
  const action = String(formData.get("action") || "");
  const actor = session.displayName;
  const note = String(formData.get("note") || "").trim();

  if (action === "ocr_match") {
    if (!canDoApproval(session, "confirmOcr")) redirect(`/dashboard/requests/payments/${requestId}`);
    await updatePaymentRequestStatus(requestId, "ocr_match", { actor, note });
  } else if (action === "ocr_flag_exception") {
    if (!canDoApproval(session, "confirmOcr")) redirect(`/dashboard/requests/payments/${requestId}`);
    await updatePaymentRequestStatus(requestId, "ocr_flag_exception", { actor, note });
  } else if (action === "ocr_exception_confirm") {
    if (!canDoApproval(session, "confirmOcr")) redirect(`/dashboard/requests/payments/${requestId}`);
    await updatePaymentRequestStatus(requestId, "ocr_exception_confirm", { actor, note });
  } else if (action === "approve") {
    if (!canDoApproval(session, "approve")) redirect(`/dashboard/requests/payments/${requestId}`);
    await updatePaymentRequestStatus(requestId, "approve", { actor, note });
  } else if (action === "reject") {
    if (!canDoApproval(session, "reject")) redirect(`/dashboard/requests/payments/${requestId}`);
    await updatePaymentRequestStatus(requestId, "reject", { actor, note });
  } else if (action === "cancel") {
    if (!canDoApproval(session, "cancelOwnRequest")) redirect(`/dashboard/requests/payments/${requestId}`);
    await updatePaymentRequestStatus(requestId, "cancel", { actor, note });
  } else if (action === "return_to_draft") {
    if (!canDoApproval(session, "returnToDraft")) redirect(`/dashboard/requests/payments/${requestId}`);
    await updatePaymentRequestStatus(requestId, "return_to_draft", { actor, note });
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/ocr");
  revalidatePath("/dashboard/requests/payments");
  revalidatePath(`/dashboard/requests/payments/${requestId}`);
  revalidatePath("/dashboard/reports");
  revalidatePath("/dashboard/ledger");
  redirect(`/dashboard/requests/payments/${requestId}`);
}

export async function recordPaymentExecutionAction(formData: FormData) {
  const session = await requirePageAccess("payment_execution");
  if (!canDoApproval(session, "executePayment")) {
    redirect("/dashboard/execution");
  }
  const requestId = String(formData.get("requestId") || "");
  const bankAccountName = String(formData.get("bankAccountName") || "").trim();
  const bankAccount = (await getBankAccountConfigViewAsync()).find((item) => item.isActive && item.accountName === bankAccountName);
  await addPaymentExecution({
    requestId,
    bankAccountName: bankAccount?.accountName ?? bankAccountName,
    amount: Number(formData.get("amount") || 0),
    executedAt: String(formData.get("executedAt") || "").trim(),
    bankReference: String(formData.get("bankReference") || "").trim(),
    voucherFiles: String(formData.get("voucherFiles") || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
    note: String(formData.get("note") || "").trim(),
    executorName: session.displayName
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/ocr");
  revalidatePath("/dashboard/requests/payments");
  revalidatePath(`/dashboard/requests/payments/${requestId}`);
  revalidatePath("/dashboard/reports");
  revalidatePath("/dashboard/ledger");
  redirect(`/dashboard/requests/payments/${requestId}`);
}

export async function verifyPaymentExecutionAction(formData: FormData) {
  const session = await requirePageAccess("payment_execution");
  if (!canDoApproval(session, "executePayment")) {
    redirect("/dashboard/execution");
  }
  const requestId = String(formData.get("requestId") || "");
  const executionId = String(formData.get("executionId") || "");
  const action = String(formData.get("action") || "verify");

  await updatePaymentExecutionVerification({
    executionId,
    action: action === "flag_exception" ? "flag_exception" : "verify",
    actor: session.displayName,
    note: String(formData.get("note") || "").trim()
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/execution");
  revalidatePath("/dashboard/approvals");
  revalidatePath("/dashboard/requests/payments");
  revalidatePath(`/dashboard/requests/payments/${requestId}`);
  redirect(`/dashboard/requests/payments/${requestId}`);
}
