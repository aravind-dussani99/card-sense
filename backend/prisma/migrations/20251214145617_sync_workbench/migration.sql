-- CreateTable
CREATE TABLE "SyncedDraftTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceType" TEXT NOT NULL,
    "bankAccountId" TEXT,
    "cardId" TEXT,
    "dedupeKey" TEXT NOT NULL,
    "providerTransactionId" TEXT,
    "reference" TEXT,
    "transactionType" TEXT,
    "direction" TEXT,
    "amount" REAL NOT NULL,
    "currency" TEXT,
    "description" TEXT,
    "merchantName" TEXT,
    "merchantCategoryCode" TEXT,
    "category" TEXT,
    "subCategory" TEXT,
    "bookingDate" DATETIME NOT NULL,
    "valueDate" DATETIME,
    "runningBalance" REAL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "rawData" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SyncedDraftTransaction_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SyncedDraftTransaction_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SyncedApprovedTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceDraftId" TEXT,
    "sourceType" TEXT NOT NULL,
    "bankAccountId" TEXT,
    "cardId" TEXT,
    "dedupeKey" TEXT,
    "providerTransactionId" TEXT,
    "reference" TEXT,
    "transactionType" TEXT,
    "direction" TEXT,
    "amount" REAL NOT NULL,
    "currency" TEXT,
    "description" TEXT,
    "merchantName" TEXT,
    "merchantCategoryCode" TEXT,
    "category" TEXT,
    "subCategory" TEXT,
    "bookingDate" DATETIME NOT NULL,
    "valueDate" DATETIME,
    "runningBalance" REAL,
    "rawData" TEXT,
    "notes" TEXT,
    "approvedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SyncedApprovedTransaction_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SyncedApprovedTransaction_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "SyncedDraftTransaction_dedupeKey_key" ON "SyncedDraftTransaction"("dedupeKey");
