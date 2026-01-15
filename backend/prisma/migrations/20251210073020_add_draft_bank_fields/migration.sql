-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_DraftTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "emailId" TEXT,
    "cardId" TEXT,
    "bankAccountId" TEXT,
    "providerTxId" TEXT,
    "source" TEXT,
    "merchant" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "category" TEXT,
    "subCategory" TEXT,
    "description" TEXT,
    "date" DATETIME NOT NULL,
    "transactionType" TEXT NOT NULL DEFAULT 'expense',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "originalData" TEXT,
    "modifiedData" TEXT,
    "emailSubject" TEXT,
    "emailBody" TEXT,
    "needsCardCreation" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DraftTransaction_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_DraftTransaction" ("amount", "cardId", "category", "createdAt", "date", "description", "emailBody", "emailId", "emailSubject", "id", "merchant", "modifiedData", "needsCardCreation", "originalData", "status", "subCategory", "transactionType", "updatedAt") SELECT "amount", "cardId", "category", "createdAt", "date", "description", "emailBody", "emailId", "emailSubject", "id", "merchant", "modifiedData", "needsCardCreation", "originalData", "status", "subCategory", "transactionType", "updatedAt" FROM "DraftTransaction";
DROP TABLE "DraftTransaction";
ALTER TABLE "new_DraftTransaction" RENAME TO "DraftTransaction";
CREATE UNIQUE INDEX "DraftTransaction_emailId_key" ON "DraftTransaction"("emailId");
CREATE UNIQUE INDEX "DraftTransaction_providerTxId_key" ON "DraftTransaction"("providerTxId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
