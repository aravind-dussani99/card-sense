-- Add new user-managed assets tables and secure vault
CREATE TYPE "SecureRecordType" AS ENUM ('BANK_ACCOUNT', 'OVERDRAFT', 'CREDIT_CARD', 'DEBIT_CARD', 'OTHER');

CREATE TABLE "SecureVaultRecord" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "recordType" "SecureRecordType" NOT NULL,
  "label" TEXT NOT NULL,
  "bankName" TEXT,
  "accountNumber" TEXT,
  "sortCode" TEXT,
  "cardLast4" TEXT,
  "username" TEXT,
  "status" TEXT NOT NULL DEFAULT 'active',
  "encryptedPayload" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SecureVaultRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserAccount" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "bankName" TEXT,
  "accountType" TEXT NOT NULL DEFAULT 'bank',
  "accountNumber" TEXT,
  "sortCode" TEXT,
  "currency" TEXT,
  "balance" DOUBLE PRECISION,
  "limit" DOUBLE PRECISION,
  "status" TEXT NOT NULL DEFAULT 'active',
  "linkedBankAccountId" TEXT,
  "secureRecordId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "UserAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserCard" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "cardType" TEXT NOT NULL DEFAULT 'credit',
  "label" TEXT NOT NULL,
  "issuerBankName" TEXT,
  "network" TEXT,
  "last4" TEXT,
  "statementDay" INTEGER,
  "dueDay" INTEGER,
  "last3StatementDates" TEXT,
  "last3DueDates" TEXT,
  "status" TEXT NOT NULL DEFAULT 'active',
  "imageUrl" TEXT,
  "linkedBankAccountId" TEXT,
  "secureRecordId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "UserCard_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserAccountCard" (
  "id" TEXT NOT NULL,
  "userAccountId" TEXT NOT NULL,
  "userCardId" TEXT NOT NULL,
  "relationType" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "UserAccountCard_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserAccountCard_userAccountId_userCardId_key" ON "UserAccountCard"("userAccountId", "userCardId");

ALTER TABLE "SecureVaultRecord" ADD CONSTRAINT "SecureVaultRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserAccount" ADD CONSTRAINT "UserAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserAccount" ADD CONSTRAINT "UserAccount_linkedBankAccountId_fkey" FOREIGN KEY ("linkedBankAccountId") REFERENCES "BankAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "UserAccount" ADD CONSTRAINT "UserAccount_secureRecordId_fkey" FOREIGN KEY ("secureRecordId") REFERENCES "SecureVaultRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "UserCard" ADD CONSTRAINT "UserCard_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserCard" ADD CONSTRAINT "UserCard_linkedBankAccountId_fkey" FOREIGN KEY ("linkedBankAccountId") REFERENCES "BankAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "UserCard" ADD CONSTRAINT "UserCard_secureRecordId_fkey" FOREIGN KEY ("secureRecordId") REFERENCES "SecureVaultRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "UserAccountCard" ADD CONSTRAINT "UserAccountCard_userAccountId_fkey" FOREIGN KEY ("userAccountId") REFERENCES "UserAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserAccountCard" ADD CONSTRAINT "UserAccountCard_userCardId_fkey" FOREIGN KEY ("userCardId") REFERENCES "UserCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;
