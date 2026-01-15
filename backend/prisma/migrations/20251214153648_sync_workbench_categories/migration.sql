-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_SyncedApprovedTransaction" (
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
    "categoryId" TEXT,
    "subCategory" TEXT,
    "subCategoryId" TEXT,
    "bookingDate" DATETIME NOT NULL,
    "valueDate" DATETIME,
    "runningBalance" REAL,
    "rawData" TEXT,
    "notes" TEXT,
    "approvedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SyncedApprovedTransaction_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SyncedApprovedTransaction_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SyncedApprovedTransaction_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SyncedApprovedTransaction_subCategoryId_fkey" FOREIGN KEY ("subCategoryId") REFERENCES "SubCategory" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_SyncedApprovedTransaction" ("amount", "approvedAt", "bankAccountId", "bookingDate", "cardId", "category", "createdAt", "currency", "dedupeKey", "description", "direction", "id", "merchantCategoryCode", "merchantName", "notes", "providerTransactionId", "rawData", "reference", "runningBalance", "sourceDraftId", "sourceType", "subCategory", "transactionType", "valueDate") SELECT "amount", "approvedAt", "bankAccountId", "bookingDate", "cardId", "category", "createdAt", "currency", "dedupeKey", "description", "direction", "id", "merchantCategoryCode", "merchantName", "notes", "providerTransactionId", "rawData", "reference", "runningBalance", "sourceDraftId", "sourceType", "subCategory", "transactionType", "valueDate" FROM "SyncedApprovedTransaction";
DROP TABLE "SyncedApprovedTransaction";
ALTER TABLE "new_SyncedApprovedTransaction" RENAME TO "SyncedApprovedTransaction";
CREATE TABLE "new_SyncedDraftTransaction" (
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
    "categoryId" TEXT,
    "subCategory" TEXT,
    "subCategoryId" TEXT,
    "bookingDate" DATETIME NOT NULL,
    "valueDate" DATETIME,
    "runningBalance" REAL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "rawData" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SyncedDraftTransaction_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SyncedDraftTransaction_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SyncedDraftTransaction_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SyncedDraftTransaction_subCategoryId_fkey" FOREIGN KEY ("subCategoryId") REFERENCES "SubCategory" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_SyncedDraftTransaction" ("amount", "bankAccountId", "bookingDate", "cardId", "category", "createdAt", "currency", "dedupeKey", "description", "direction", "id", "merchantCategoryCode", "merchantName", "notes", "providerTransactionId", "rawData", "reference", "runningBalance", "sourceType", "status", "subCategory", "transactionType", "updatedAt", "valueDate") SELECT "amount", "bankAccountId", "bookingDate", "cardId", "category", "createdAt", "currency", "dedupeKey", "description", "direction", "id", "merchantCategoryCode", "merchantName", "notes", "providerTransactionId", "rawData", "reference", "runningBalance", "sourceType", "status", "subCategory", "transactionType", "updatedAt", "valueDate" FROM "SyncedDraftTransaction";
DROP TABLE "SyncedDraftTransaction";
ALTER TABLE "new_SyncedDraftTransaction" RENAME TO "SyncedDraftTransaction";
CREATE UNIQUE INDEX "SyncedDraftTransaction_dedupeKey_key" ON "SyncedDraftTransaction"("dedupeKey");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
