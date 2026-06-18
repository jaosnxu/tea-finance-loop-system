import {
  approvalFlowTemplates,
  bankAccounts,
  contractApprovals,
  contractLedgers,
  departments,
  exchangeRates,
  ledgerEntries as seedLedgerEntries,
  ledgerAccountMappings,
  ocrRules,
  organizations,
  paymentExecutions as seedExecutions,
  paymentParties,
  paymentRequestFormTemplate,
  paymentRequests as seedPaymentRequests,
  persons,
  projects,
  purchaseLedgers,
  purchaseRequests,
  roleConfigs,
  userAccounts,
} from "@/lib/mock-data";
import { writeDatabaseConfigState, writeDatabaseState } from "@/lib/persistence-db";

async function main() {
  await writeDatabaseState({
    paymentRequests: seedPaymentRequests,
    paymentExecutions: seedExecutions,
    ledgerEntries: seedLedgerEntries,
    purchaseRequests,
    purchaseLedgers,
    contractApprovals,
    contractLedgers,
  });
  await writeDatabaseConfigState({
    organizations,
    departments,
    persons,
    projects,
    ocrRules,
    approvalFlowTemplates,
    paymentRequestFormTemplate,
    bankAccounts,
    exchangeRates,
    ledgerAccountMappings,
    paymentParties,
    roleConfigs,
    userAccounts,
  });
  console.log("Seeded tea-finance-system database snapshot");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
