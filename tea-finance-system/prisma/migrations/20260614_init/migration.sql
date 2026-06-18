-- CreateEnum
CREATE TYPE "CurrencyCode" AS ENUM ('RUB', 'CNY', 'USD');

-- CreateEnum
CREATE TYPE "PaymentRequestStatus" AS ENUM ('draft', 'submitted', 'ocr_pending', 'ocr_exception_pending_confirm', 'processing', 'approved_waiting_payment', 'partially_paid', 'paid', 'rejected', 'cancelled');

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "taxMode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankAccount" (
    "id" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "currency" "CurrencyCode" NOT NULL,
    "balance" DECIMAL(18,2) NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BankAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentParty" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "partyType" TEXT NOT NULL,
    "bankName" TEXT,
    "bankAccount" TEXT,
    "contactName" TEXT,
    "phone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentParty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentRequest" (
    "id" TEXT NOT NULL,
    "requestNo" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "applicantName" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL,
    "purpose" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "paidAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "currency" "CurrencyCode" NOT NULL,
    "status" "PaymentRequestStatus" NOT NULL DEFAULT 'draft',
    "organizationId" TEXT NOT NULL,
    "paymentPartyId" TEXT NOT NULL,
    "projectName" TEXT,
    "paymentPartyType" TEXT NOT NULL,
    "paymentPartyBank" TEXT,
    "paymentPartyAccount" TEXT,
    "isInternal" BOOLEAN NOT NULL DEFAULT false,
    "internalTarget" TEXT,
    "flowTemplateId" TEXT,
    "flowTemplateName" TEXT,
    "currentApprovalNode" TEXT,
    "currentHandler" TEXT,
    "ccUsers" JSONB NOT NULL,
    "approvalHistory" JSONB NOT NULL,
    "ocrStatus" TEXT NOT NULL DEFAULT 'not_started',
    "attachments" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentExecution" (
    "id" TEXT NOT NULL,
    "paymentRequestId" TEXT NOT NULL,
    "bankAccountId" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "executedAt" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "executorName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentExecution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LedgerEntry" (
    "id" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceNo" TEXT NOT NULL,
    "organizationName" TEXT NOT NULL,
    "projectName" TEXT,
    "businessDate" TIMESTAMP(3) NOT NULL,
    "currency" "CurrencyCode" NOT NULL,
    "originalAmount" DECIMAL(18,2) NOT NULL,
    "exchangeRate" DECIMAL(18,6) NOT NULL,
    "functionalAmount" DECIMAL(18,2) NOT NULL,
    "direction" TEXT NOT NULL,
    "accountCode" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "paymentRequestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemConfigSnapshot" (
    "id" TEXT NOT NULL,
    "organizations" JSONB NOT NULL,
    "approvalFlowTemplates" JSONB NOT NULL,
    "paymentRequestForm" JSONB NOT NULL,
    "bankAccounts" JSONB NOT NULL,
    "exchangeRates" JSONB NOT NULL,
    "ledgerAccountMappings" JSONB NOT NULL,
    "paymentParties" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemConfigSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentRequest_requestNo_key" ON "PaymentRequest"("requestNo");

-- AddForeignKey
ALTER TABLE "BankAccount" ADD CONSTRAINT "BankAccount_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRequest" ADD CONSTRAINT "PaymentRequest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRequest" ADD CONSTRAINT "PaymentRequest_paymentPartyId_fkey" FOREIGN KEY ("paymentPartyId") REFERENCES "PaymentParty"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentExecution" ADD CONSTRAINT "PaymentExecution_paymentRequestId_fkey" FOREIGN KEY ("paymentRequestId") REFERENCES "PaymentRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentExecution" ADD CONSTRAINT "PaymentExecution_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_paymentRequestId_fkey" FOREIGN KEY ("paymentRequestId") REFERENCES "PaymentRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
