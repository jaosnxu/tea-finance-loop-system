import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type {
  ContractApprovalRecord,
  ContractLedgerRecord,
  LedgerEntryRecord,
  PaymentExecutionRecord,
  PaymentRequestRecord,
  PurchaseLedgerRecord,
  PurchaseRequestRecord
} from "@/lib/mock-data";
import {
  approvalFlowTemplates,
  bankAccounts,
  contractApprovals,
  contractLedgers,
  departments,
  exchangeRates,
  ledgerAccountMappings,
  ocrRules,
  organizations,
  paymentParties,
  paymentRequestFormTemplate,
  persons,
  projects,
  purchaseLedgers,
  purchaseRequests,
  roleConfigs,
  userAccounts,
} from "@/lib/mock-data";
import { getPrismaClient } from "@/lib/prisma";

type RuntimeStateLike = {
  paymentRequests: PaymentRequestRecord[];
  paymentExecutions: PaymentExecutionRecord[];
  ledgerEntries: LedgerEntryRecord[];
  purchaseRequests: PurchaseRequestRecord[];
  purchaseLedgers: PurchaseLedgerRecord[];
  contractApprovals: ContractApprovalRecord[];
  contractLedgers: ContractLedgerRecord[];
};

type ConfigStateLike = {
  organizations: typeof organizations;
  departments: typeof departments;
  persons: typeof persons;
  projects: typeof projects;
  ocrRules: typeof ocrRules;
  approvalFlowTemplates: typeof approvalFlowTemplates;
  paymentRequestFormTemplate: typeof paymentRequestFormTemplate;
  bankAccounts: typeof bankAccounts;
  exchangeRates: typeof exchangeRates;
  ledgerAccountMappings: typeof ledgerAccountMappings;
  paymentParties: typeof paymentParties;
  roleConfigs: typeof roleConfigs;
  userAccounts: typeof userAccounts;
};

function asStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string");
}

function asApprovalHistory(
  value: unknown
): PaymentRequestRecord["approvalHistory"] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return [];
    }
    const row = item as Record<string, unknown>;
    return [
      {
        id: typeof row.id === "string" ? row.id : "",
        action: typeof row.action === "string" ? row.action : "",
        node: typeof row.node === "string" ? row.node : null,
        actor: typeof row.actor === "string" ? row.actor : "",
        result: typeof row.result === "string" ? row.result : "",
        note: typeof row.note === "string" ? row.note : "",
        actedAt: typeof row.actedAt === "string" ? row.actedAt : new Date().toISOString(),
      },
    ];
  });
}

function asAttachments(
  value: unknown
): PaymentRequestRecord["attachments"] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { invoice: [], contract: [], voucher: [], other: [] };
  }
  const row = value as Record<string, unknown>;
  return {
    invoice: asStringArray(row.invoice),
    contract: asStringArray(row.contract),
    voucher: asStringArray(row.voucher),
    other: asStringArray(row.other),
  };
}

function asVoucherFiles(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string");
}

export async function readDatabaseState(): Promise<RuntimeStateLike> {
  const prisma = await getPrismaClient();
  const [paymentRequests, paymentExecutions, ledgerEntries, purchaseRequestsRows, purchaseLedgerRows, contractApprovalRows, contractLedgerRows] = await Promise.all([
    prisma.paymentRequest.findMany({
      include: {
        organization: true,
        paymentParty: true,
      },
      orderBy: { requestedAt: "desc" },
    }),
    prisma.paymentExecution.findMany({
      include: {
        bankAccount: true,
        paymentRequest: true,
      },
      orderBy: { executedAt: "desc" },
    }),
    prisma.ledgerEntry.findMany({
      orderBy: { businessDate: "desc" },
    }),
    prisma.purchaseRequest.findMany({
      orderBy: { requestedAt: "desc" },
    }),
    prisma.purchaseLedger.findMany({
      orderBy: { createdAtDate: "desc" },
    }),
    prisma.contractApproval.findMany({
      orderBy: { requestedAt: "desc" },
    }),
    prisma.contractLedger.findMany({
      orderBy: { effectiveDate: "desc" },
    }),
  ]);

  return {
    paymentRequests: paymentRequests.map((request: any) => ({
      id: request.id,
      title: request.title,
      organization: request.organization.name,
      projectName: request.projectName,
      applicantName: request.applicantName,
      requestedAt: request.requestedAt.toISOString(),
      purpose: request.purpose,
      amount: Number(request.amount),
      paidAmount: Number(request.paidAmount),
      currency: request.currency,
      status: request.status,
      paymentPartyName: request.paymentParty.name,
      paymentPartyType: request.paymentPartyType as PaymentRequestRecord["paymentPartyType"],
      paymentPartyBank: request.paymentPartyBank ?? request.paymentParty.bankName ?? "",
      paymentPartyAccount: request.paymentPartyAccount ?? request.paymentParty.bankAccount ?? "",
      isInternal: request.isInternal,
      internalTarget: request.internalTarget,
      flowTemplateId: request.flowTemplateId,
      flowTemplateName: request.flowTemplateName,
      currentApprovalNode: request.currentApprovalNode,
      currentHandler: request.currentHandler,
      ccUsers: asStringArray(request.ccUsers),
      approvalHistory: asApprovalHistory(request.approvalHistory),
      ocrStatus: request.ocrStatus as PaymentRequestRecord["ocrStatus"],
      attachments: asAttachments(request.attachments),
    })),
    paymentExecutions: paymentExecutions.map((execution: any) => ({
      id: execution.id,
      paymentRequestId: execution.paymentRequestId,
      bankAccountName: execution.bankAccount.accountName,
      amount: Number(execution.amount),
      currency: execution.paymentRequest.currency,
      executedAt: execution.executedAt.toISOString(),
      bankReference: execution.bankReference ?? "",
      voucherFiles: asVoucherFiles(execution.voucherFiles),
      note: execution.note ?? "",
      executorName: execution.executorName,
      verificationStatus: execution.verificationStatus ?? "pending",
      verificationNote: execution.verificationNote ?? "",
      verifiedBy: execution.verifiedBy ?? null,
      verifiedAt: execution.verifiedAt ? execution.verifiedAt.toISOString() : null,
    })),
    ledgerEntries: ledgerEntries.map((entry: any) => ({
      id: entry.id,
      paymentRequestId: entry.paymentRequestId ?? "",
      sourceType: entry.sourceType,
      sourceNo: entry.sourceNo,
      organization: entry.organizationName,
      projectName: entry.projectName,
      businessDate: entry.businessDate.toISOString(),
      currency: entry.currency,
      originalAmount: Number(entry.originalAmount),
      exchangeRate: Number(entry.exchangeRate),
      functionalAmount: Number(entry.functionalAmount),
      direction: entry.direction as LedgerEntryRecord["direction"],
      accountCode: entry.accountCode,
      accountName: entry.accountName,
      summary: entry.summary,
    })),
    purchaseRequests: purchaseRequestsRows.map((row: any) => ({
      id: row.id,
      title: row.title,
      organization: row.organizationName,
      projectName: row.projectName,
      applicantName: row.applicantName,
      requestedAt: row.requestedAt.toISOString().slice(0, 10),
      supplierName: row.supplierName,
      purchaseType: row.purchaseType,
      content: row.content,
      specification: row.specification,
      quantity: Number(row.quantity),
      unit: row.unit,
      unitPrice: Number(row.unitPrice),
      currency: row.currency,
      amount: Number(row.amount),
      purpose: row.purpose,
      expectedArrivalDate: row.expectedArrivalDate.toISOString().slice(0, 10),
      requiresPayment: row.requiresPayment,
      requiresInventory: row.requiresInventory,
      linkedContractName: row.linkedContractName,
      status: row.status,
      currentApprovalNode: row.currentApprovalNode,
      currentHandler: row.currentHandler,
      approvalHistory: asApprovalHistory(row.approvalHistory),
      attachments: asStringArray(row.attachments),
    })),
    purchaseLedgers: purchaseLedgerRows.map((row: any) => ({
      id: row.id,
      purchaseRequestId: row.purchaseRequestId,
      organization: row.organizationName,
      supplierName: row.supplierName,
      purchaseType: row.purchaseType,
      amount: Number(row.amount),
      currency: row.currency,
      createdAt: row.createdAtDate.toISOString().slice(0, 10),
      status: row.status,
      note: row.note,
    })),
    contractApprovals: contractApprovalRows.map((row: any) => ({
      id: row.id,
      title: row.title,
      organization: row.organizationName,
      projectName: row.projectName,
      applicantName: row.applicantName,
      requestedAt: row.requestedAt.toISOString().slice(0, 10),
      contractName: row.contractName,
      contractNo: row.contractNo,
      contractType: row.contractType,
      counterpartyName: row.counterpartyName,
      currency: row.currency,
      amount: Number(row.amount),
      signedAt: row.signedAt.toISOString().slice(0, 10),
      effectiveDate: row.effectiveDate.toISOString().slice(0, 10),
      expiryDate: row.expiryDate.toISOString().slice(0, 10),
      paymentTerms: row.paymentTerms,
      settlementMethod: row.settlementMethod,
      summary: row.summary,
      status: row.status,
      currentApprovalNode: row.currentApprovalNode,
      currentHandler: row.currentHandler,
      ocrStatus: row.ocrStatus,
      approvalHistory: asApprovalHistory(row.approvalHistory),
      attachments: asStringArray(row.attachments),
    })),
    contractLedgers: contractLedgerRows.map((row: any) => ({
      id: row.id,
      contractRequestId: row.contractRequestId,
      organization: row.organizationName,
      contractName: row.contractName,
      contractNo: row.contractNo,
      counterpartyName: row.counterpartyName,
      amount: Number(row.amount),
      currency: row.currency,
      effectiveDate: row.effectiveDate.toISOString().slice(0, 10),
      expiryDate: row.expiryDate.toISOString().slice(0, 10),
      status: row.status,
      note: row.note,
    })),
  };
}

export async function writeDatabaseState(state: RuntimeStateLike) {
  const prisma = await getPrismaClient();

  await prisma.$transaction(async (tx: any) => {
    const organizationRows = await tx.organization.findMany();
    const paymentPartyRows = await tx.paymentParty.findMany();
    const bankAccountRows = await tx.bankAccount.findMany();

    const organizationIdByName = new Map(
      organizationRows.map((organization: any) => [organization.name, organization.id])
    );
    const paymentPartyIdByName = new Map(paymentPartyRows.map((party: any) => [party.name, party.id]));
    const bankAccountIdByName = new Map(bankAccountRows.map((account: any) => [account.accountName, account.id]));

    for (const request of state.paymentRequests) {
      const organizationId =
        organizationIdByName.get(request.organization) ??
        organizations.find((organization) => organization.displayName === request.organization)?.id;
      const paymentPartyId =
        paymentPartyIdByName.get(request.paymentPartyName) ??
        paymentParties.find((party) => party.name === request.paymentPartyName)?.id;

      if (!organizationId || !paymentPartyId) {
        throw new Error(`database reference missing for payment request ${request.id}`);
      }

      await tx.paymentRequest.upsert({
        where: { id: request.id },
        data: {
          id: request.id,
          requestNo: request.id,
          title: request.title,
          applicantName: request.applicantName,
          requestedAt: new Date(request.requestedAt),
          purpose: request.purpose,
          amount: request.amount,
          paidAmount: request.paidAmount,
          currency: request.currency,
          status: request.status,
          organizationId,
          paymentPartyId,
          projectName: request.projectName,
          paymentPartyType: request.paymentPartyType,
          paymentPartyBank: request.paymentPartyBank || null,
          paymentPartyAccount: request.paymentPartyAccount || null,
          isInternal: request.isInternal,
          internalTarget: request.internalTarget,
          flowTemplateId: request.flowTemplateId,
          flowTemplateName: request.flowTemplateName,
          currentApprovalNode: request.currentApprovalNode,
          currentHandler: request.currentHandler,
          ccUsers: request.ccUsers,
          approvalHistory: request.approvalHistory,
          ocrStatus: request.ocrStatus,
          attachments: request.attachments,
        },
        create: {
          id: request.id,
          requestNo: request.id,
          title: request.title,
          applicantName: request.applicantName,
          requestedAt: new Date(request.requestedAt),
          purpose: request.purpose,
          amount: request.amount,
          paidAmount: request.paidAmount,
          currency: request.currency,
          status: request.status,
          organizationId,
          paymentPartyId,
          projectName: request.projectName,
          paymentPartyType: request.paymentPartyType,
          paymentPartyBank: request.paymentPartyBank || null,
          paymentPartyAccount: request.paymentPartyAccount || null,
          isInternal: request.isInternal,
          internalTarget: request.internalTarget,
          flowTemplateId: request.flowTemplateId,
          flowTemplateName: request.flowTemplateName,
          currentApprovalNode: request.currentApprovalNode,
          currentHandler: request.currentHandler,
          ccUsers: request.ccUsers,
          approvalHistory: request.approvalHistory,
          ocrStatus: request.ocrStatus,
          attachments: request.attachments,
        },
      });
    }
    await tx.paymentRequest.deleteMany({
      where: {
        id: {
          notIn: state.paymentRequests.map((request) => request.id),
        },
      },
    });

    for (const execution of state.paymentExecutions) {
      const bankAccountId =
        bankAccountIdByName.get(execution.bankAccountName) ??
        bankAccounts.find((account) => account.accountName === execution.bankAccountName)?.id;

      if (!bankAccountId) {
        throw new Error(`database bank account missing for execution ${execution.id}`);
      }

      await tx.paymentExecution.upsert({
        where: { id: execution.id },
        data: {
          id: execution.id,
          paymentRequestId: execution.paymentRequestId,
          bankAccountId,
          amount: execution.amount,
          executedAt: new Date(execution.executedAt),
          bankReference: execution.bankReference || null,
          voucherFiles: execution.voucherFiles,
          note: execution.note,
          executorName: execution.executorName,
          verificationStatus: execution.verificationStatus,
          verificationNote: execution.verificationNote || null,
          verifiedBy: execution.verifiedBy,
          verifiedAt: execution.verifiedAt ? new Date(execution.verifiedAt) : null,
        },
        create: {
          id: execution.id,
          paymentRequestId: execution.paymentRequestId,
          bankAccountId,
          amount: execution.amount,
          executedAt: new Date(execution.executedAt),
          bankReference: execution.bankReference || null,
          voucherFiles: execution.voucherFiles,
          note: execution.note,
          executorName: execution.executorName,
          verificationStatus: execution.verificationStatus,
          verificationNote: execution.verificationNote || null,
          verifiedBy: execution.verifiedBy,
          verifiedAt: execution.verifiedAt ? new Date(execution.verifiedAt) : null,
        },
      });
    }
    await tx.paymentExecution.deleteMany({
      where: {
        id: {
          notIn: state.paymentExecutions.map((execution) => execution.id),
        },
      },
    });

    for (const entry of state.ledgerEntries) {
      await tx.ledgerEntry.upsert({
        where: { id: entry.id },
        data: {
          id: entry.id,
          sourceType: entry.sourceType,
          sourceNo: entry.sourceNo,
          organizationName: entry.organization,
          projectName: entry.projectName,
          businessDate: new Date(entry.businessDate),
          currency: entry.currency,
          originalAmount: entry.originalAmount,
          exchangeRate: entry.exchangeRate,
          functionalAmount: entry.functionalAmount,
          direction: entry.direction,
          accountCode: entry.accountCode,
          accountName: entry.accountName,
          summary: entry.summary,
          paymentRequestId: entry.paymentRequestId || null,
        },
        create: {
          id: entry.id,
          sourceType: entry.sourceType,
          sourceNo: entry.sourceNo,
          organizationName: entry.organization,
          projectName: entry.projectName,
          businessDate: new Date(entry.businessDate),
          currency: entry.currency,
          originalAmount: entry.originalAmount,
          exchangeRate: entry.exchangeRate,
          functionalAmount: entry.functionalAmount,
          direction: entry.direction,
          accountCode: entry.accountCode,
          accountName: entry.accountName,
          summary: entry.summary,
          paymentRequestId: entry.paymentRequestId || null,
        },
      });
    }
    await tx.ledgerEntry.deleteMany({
      where: {
        id: {
          notIn: state.ledgerEntries.map((entry) => entry.id),
        },
      },
    });

    for (const request of state.purchaseRequests) {
      await tx.purchaseRequest.upsert({
        where: { id: request.id },
        update: {
          title: request.title,
          organizationName: request.organization,
          projectName: request.projectName,
          applicantName: request.applicantName,
          requestedAt: new Date(request.requestedAt),
          supplierName: request.supplierName,
          purchaseType: request.purchaseType,
          content: request.content,
          specification: request.specification,
          quantity: request.quantity,
          unit: request.unit,
          unitPrice: request.unitPrice,
          currency: request.currency,
          amount: request.amount,
          purpose: request.purpose,
          expectedArrivalDate: new Date(request.expectedArrivalDate),
          requiresPayment: request.requiresPayment,
          requiresInventory: request.requiresInventory,
          linkedContractName: request.linkedContractName,
          status: request.status,
          currentApprovalNode: request.currentApprovalNode,
          currentHandler: request.currentHandler,
          approvalHistory: request.approvalHistory,
          attachments: request.attachments,
        },
        create: {
          id: request.id,
          title: request.title,
          organizationName: request.organization,
          projectName: request.projectName,
          applicantName: request.applicantName,
          requestedAt: new Date(request.requestedAt),
          supplierName: request.supplierName,
          purchaseType: request.purchaseType,
          content: request.content,
          specification: request.specification,
          quantity: request.quantity,
          unit: request.unit,
          unitPrice: request.unitPrice,
          currency: request.currency,
          amount: request.amount,
          purpose: request.purpose,
          expectedArrivalDate: new Date(request.expectedArrivalDate),
          requiresPayment: request.requiresPayment,
          requiresInventory: request.requiresInventory,
          linkedContractName: request.linkedContractName,
          status: request.status,
          currentApprovalNode: request.currentApprovalNode,
          currentHandler: request.currentHandler,
          approvalHistory: request.approvalHistory,
          attachments: request.attachments,
        },
      });
    }
    await tx.purchaseRequest.deleteMany({
      where: {
        id: {
          notIn: state.purchaseRequests.map((request) => request.id),
        },
      },
    });

    for (const ledger of state.purchaseLedgers) {
      await tx.purchaseLedger.upsert({
        where: { id: ledger.id },
        update: {
          purchaseRequestId: ledger.purchaseRequestId,
          organizationName: ledger.organization,
          supplierName: ledger.supplierName,
          purchaseType: ledger.purchaseType,
          amount: ledger.amount,
          currency: ledger.currency,
          createdAtDate: new Date(ledger.createdAt),
          status: ledger.status,
          note: ledger.note,
        },
        create: {
          id: ledger.id,
          purchaseRequestId: ledger.purchaseRequestId,
          organizationName: ledger.organization,
          supplierName: ledger.supplierName,
          purchaseType: ledger.purchaseType,
          amount: ledger.amount,
          currency: ledger.currency,
          createdAtDate: new Date(ledger.createdAt),
          status: ledger.status,
          note: ledger.note,
        },
      });
    }
    await tx.purchaseLedger.deleteMany({
      where: {
        id: {
          notIn: state.purchaseLedgers.map((ledger) => ledger.id),
        },
      },
    });

    for (const contract of state.contractApprovals) {
      await tx.contractApproval.upsert({
        where: { id: contract.id },
        update: {
          title: contract.title,
          organizationName: contract.organization,
          projectName: contract.projectName,
          applicantName: contract.applicantName,
          requestedAt: new Date(contract.requestedAt),
          contractName: contract.contractName,
          contractNo: contract.contractNo,
          contractType: contract.contractType,
          counterpartyName: contract.counterpartyName,
          currency: contract.currency,
          amount: contract.amount,
          signedAt: new Date(contract.signedAt),
          effectiveDate: new Date(contract.effectiveDate),
          expiryDate: new Date(contract.expiryDate),
          paymentTerms: contract.paymentTerms,
          settlementMethod: contract.settlementMethod,
          summary: contract.summary,
          status: contract.status,
          currentApprovalNode: contract.currentApprovalNode,
          currentHandler: contract.currentHandler,
          ocrStatus: contract.ocrStatus,
          approvalHistory: contract.approvalHistory,
          attachments: contract.attachments,
        },
        create: {
          id: contract.id,
          title: contract.title,
          organizationName: contract.organization,
          projectName: contract.projectName,
          applicantName: contract.applicantName,
          requestedAt: new Date(contract.requestedAt),
          contractName: contract.contractName,
          contractNo: contract.contractNo,
          contractType: contract.contractType,
          counterpartyName: contract.counterpartyName,
          currency: contract.currency,
          amount: contract.amount,
          signedAt: new Date(contract.signedAt),
          effectiveDate: new Date(contract.effectiveDate),
          expiryDate: new Date(contract.expiryDate),
          paymentTerms: contract.paymentTerms,
          settlementMethod: contract.settlementMethod,
          summary: contract.summary,
          status: contract.status,
          currentApprovalNode: contract.currentApprovalNode,
          currentHandler: contract.currentHandler,
          ocrStatus: contract.ocrStatus,
          approvalHistory: contract.approvalHistory,
          attachments: contract.attachments,
        },
      });
    }
    await tx.contractApproval.deleteMany({
      where: {
        id: {
          notIn: state.contractApprovals.map((contract) => contract.id),
        },
      },
    });

    for (const ledger of state.contractLedgers) {
      await tx.contractLedger.upsert({
        where: { id: ledger.id },
        update: {
          contractRequestId: ledger.contractRequestId,
          organizationName: ledger.organization,
          contractName: ledger.contractName,
          contractNo: ledger.contractNo,
          counterpartyName: ledger.counterpartyName,
          amount: ledger.amount,
          currency: ledger.currency,
          effectiveDate: new Date(ledger.effectiveDate),
          expiryDate: new Date(ledger.expiryDate),
          status: ledger.status,
          note: ledger.note,
        },
        create: {
          id: ledger.id,
          contractRequestId: ledger.contractRequestId,
          organizationName: ledger.organization,
          contractName: ledger.contractName,
          contractNo: ledger.contractNo,
          counterpartyName: ledger.counterpartyName,
          amount: ledger.amount,
          currency: ledger.currency,
          effectiveDate: new Date(ledger.effectiveDate),
          expiryDate: new Date(ledger.expiryDate),
          status: ledger.status,
          note: ledger.note,
        },
      });
    }
    await tx.contractLedger.deleteMany({
      where: {
        id: {
          notIn: state.contractLedgers.map((ledger) => ledger.id),
        },
      },
    });
  });
}

const CONFIG_SNAPSHOT_ID = "default";
const configCachePath = path.join(process.cwd(), "data", "runtime", "config-db-cache.json");

function writeConfigCache(state: ConfigStateLike) {
  mkdirSync(path.dirname(configCachePath), { recursive: true });
  writeFileSync(configCachePath, JSON.stringify(state, null, 2), "utf-8");
}

export function readDatabaseConfigCache(): ConfigStateLike | null {
  if (!existsSync(configCachePath)) {
    return null;
  }
  return JSON.parse(readFileSync(configCachePath, "utf-8")) as ConfigStateLike;
}

export async function readDatabaseConfigState(): Promise<ConfigStateLike | null> {
  const prisma = await getPrismaClient();
  const snapshot = await prisma.systemConfigSnapshot.findUnique({
    where: { id: CONFIG_SNAPSHOT_ID },
  });

  if (!snapshot) {
    return null;
  }

  return {
    organizations: (snapshot.organizations as typeof organizations) ?? organizations,
    departments: (snapshot.departments as typeof departments) ?? departments,
    persons: (snapshot.persons as typeof persons) ?? persons,
    projects: (snapshot.projects as typeof projects) ?? projects,
    ocrRules: (snapshot.ocrRules as typeof ocrRules) ?? ocrRules,
    approvalFlowTemplates: (snapshot.approvalFlowTemplates as typeof approvalFlowTemplates) ?? approvalFlowTemplates,
    paymentRequestFormTemplate: (snapshot.paymentRequestForm as typeof paymentRequestFormTemplate) ?? paymentRequestFormTemplate,
    bankAccounts: (snapshot.bankAccounts as typeof bankAccounts) ?? bankAccounts,
    exchangeRates: (snapshot.exchangeRates as typeof exchangeRates) ?? exchangeRates,
    ledgerAccountMappings: (snapshot.ledgerAccountMappings as typeof ledgerAccountMappings) ?? ledgerAccountMappings,
    paymentParties: (snapshot.paymentParties as typeof paymentParties) ?? paymentParties,
    roleConfigs: (snapshot.roleConfigs as typeof roleConfigs) ?? roleConfigs,
    userAccounts: (snapshot.userAccounts as typeof userAccounts) ?? userAccounts,
  };
}

export async function writeDatabaseConfigState(state: ConfigStateLike) {
  const prisma = await getPrismaClient();
  await prisma.$transaction(async (tx: any) => {
    for (const organization of state.organizations) {
      await tx.organization.upsert({
        where: { id: organization.id },
        update: {
          name: organization.displayName,
          taxMode: organization.taxLabel,
        },
        create: {
          id: organization.id,
          name: organization.displayName,
          taxMode: organization.taxLabel,
        },
      });
    }
    await tx.organization.deleteMany({
      where: {
        id: {
          notIn: state.organizations.map((organization) => organization.id),
        },
      },
    });

    const organizationIdByName = new Map(
      state.organizations.map((organization) => [organization.displayName, organization.id])
    );

    for (const party of state.paymentParties) {
      await tx.paymentParty.upsert({
        where: { id: party.id },
        update: {
          name: party.name,
          partyType: party.type,
          bankName: party.bankName ?? null,
          bankAccount: party.bankAccount ?? null,
          contactName: party.contactName ?? null,
          phone: party.phone ?? null,
        },
        create: {
          id: party.id,
          name: party.name,
          partyType: party.type,
          bankName: party.bankName ?? null,
          bankAccount: party.bankAccount ?? null,
          contactName: party.contactName ?? null,
          phone: party.phone ?? null,
        },
      });
    }
    await tx.paymentParty.deleteMany({
      where: {
        id: {
          notIn: state.paymentParties.map((party) => party.id),
        },
      },
    });

    for (const account of state.bankAccounts) {
      const organizationId = organizationIdByName.get(account.organization);
      if (!organizationId) {
        throw new Error(`organization missing for bank account ${account.id}`);
      }
      await tx.bankAccount.upsert({
        where: { id: account.id },
        update: {
          bankName: account.bankName,
          accountName: account.accountName,
          accountNumber: account.accountNumber,
          currency: account.currency,
          balance: account.balance,
          organizationId,
        },
        create: {
          id: account.id,
          bankName: account.bankName,
          accountName: account.accountName,
          accountNumber: account.accountNumber,
          currency: account.currency,
          balance: account.balance,
          organizationId,
        },
      });
    }
    await tx.bankAccount.deleteMany({
      where: {
        id: {
          notIn: state.bankAccounts.map((account) => account.id),
        },
      },
    });

    await tx.systemConfigSnapshot.upsert({
      where: { id: CONFIG_SNAPSHOT_ID },
      create: {
        id: CONFIG_SNAPSHOT_ID,
        organizations: state.organizations,
        departments: state.departments,
        persons: state.persons,
        projects: state.projects,
        ocrRules: state.ocrRules,
        approvalFlowTemplates: state.approvalFlowTemplates,
        paymentRequestForm: state.paymentRequestFormTemplate,
        bankAccounts: state.bankAccounts,
        exchangeRates: state.exchangeRates,
        ledgerAccountMappings: state.ledgerAccountMappings,
        paymentParties: state.paymentParties,
        roleConfigs: state.roleConfigs,
        userAccounts: state.userAccounts,
      },
      update: {
        organizations: state.organizations,
        departments: state.departments,
        persons: state.persons,
        projects: state.projects,
        ocrRules: state.ocrRules,
        approvalFlowTemplates: state.approvalFlowTemplates,
        paymentRequestForm: state.paymentRequestFormTemplate,
        bankAccounts: state.bankAccounts,
        exchangeRates: state.exchangeRates,
        ledgerAccountMappings: state.ledgerAccountMappings,
        paymentParties: state.paymentParties,
        roleConfigs: state.roleConfigs,
        userAccounts: state.userAccounts,
      },
    });
  });
  writeConfigCache(state);
}
