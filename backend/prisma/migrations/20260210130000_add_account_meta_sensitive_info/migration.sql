-- Add account metadata and sensitive info tables
CREATE TYPE "AccountType" AS ENUM (
  'BANK_ACCOUNT',
  'OVERDRAFT',
  'CREDIT_CARD',
  'DEBIT_CARD',
  'CASH_ACCOUNT',
  'CASH_CARD',
  'OTHER'
);

CREATE TABLE "AccountMeta" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "linkedBankAccountId" TEXT,
  "parentAccountId" TEXT,
  "accountType" "AccountType" NOT NULL,
  "label" TEXT NOT NULL,
  "accountHolderName" TEXT,
  "bankName" TEXT,
  "currency" TEXT,
  "accountNumber" TEXT,
  "sortCode" TEXT,
  "cardNetwork" TEXT,
  "cardLast4" TEXT,
  "cardImageUrl" TEXT,
  "statementDay" INTEGER,
  "dueDay" INTEGER,
  "last3StatementDates" TEXT,
  "last3DueDates" TEXT,
  "status" TEXT NOT NULL DEFAULT 'active',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AccountMeta_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SensitiveInfo" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "accountMetaId" TEXT NOT NULL,
  "encryptedPayload" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SensitiveInfo_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "AccountMeta" ADD CONSTRAINT "AccountMeta_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AccountMeta" ADD CONSTRAINT "AccountMeta_linkedBankAccountId_fkey" FOREIGN KEY ("linkedBankAccountId") REFERENCES "BankAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AccountMeta" ADD CONSTRAINT "AccountMeta_parentAccountId_fkey" FOREIGN KEY ("parentAccountId") REFERENCES "AccountMeta"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SensitiveInfo" ADD CONSTRAINT "SensitiveInfo_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SensitiveInfo" ADD CONSTRAINT "SensitiveInfo_accountMetaId_fkey" FOREIGN KEY ("accountMetaId") REFERENCES "AccountMeta"("id") ON DELETE CASCADE ON UPDATE CASCADE;
