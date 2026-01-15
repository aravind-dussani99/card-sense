-- AlterTable
ALTER TABLE "BankTransaction" ADD COLUMN "runningBalance" REAL;

-- CreateTable
CREATE TABLE "MerchantCategoryRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "merchantKey" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'provider',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_BankAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "connectionId" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "type" TEXT,
    "name" TEXT,
    "productCode" TEXT,
    "planName" TEXT,
    "benefitsJson" TEXT,
    "tags" TEXT,
    "currency" TEXT,
    "mask" TEXT,
    "balance" REAL NOT NULL DEFAULT 0,
    "availableBalance" REAL,
    "limit" REAL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BankAccount_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "BankConnection" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_BankAccount" ("benefitsJson", "connectionId", "createdAt", "currency", "id", "mask", "name", "planName", "productCode", "providerAccountId", "status", "tags", "type", "updatedAt") SELECT "benefitsJson", "connectionId", "createdAt", "currency", "id", "mask", "name", "planName", "productCode", "providerAccountId", "status", "tags", "type", "updatedAt" FROM "BankAccount";
DROP TABLE "BankAccount";
ALTER TABLE "new_BankAccount" RENAME TO "BankAccount";
CREATE UNIQUE INDEX "BankAccount_providerAccountId_key" ON "BankAccount"("providerAccountId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "MerchantCategoryRule_merchantKey_key" ON "MerchantCategoryRule"("merchantKey");
