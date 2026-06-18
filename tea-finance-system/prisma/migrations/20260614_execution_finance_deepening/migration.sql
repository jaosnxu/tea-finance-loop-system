ALTER TABLE "PaymentExecution"
ADD COLUMN "bankReference" TEXT,
ADD COLUMN "voucherFiles" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN "verificationStatus" TEXT NOT NULL DEFAULT 'pending',
ADD COLUMN "verificationNote" TEXT,
ADD COLUMN "verifiedBy" TEXT,
ADD COLUMN "verifiedAt" TIMESTAMP(3);
