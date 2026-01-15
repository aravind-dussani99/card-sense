-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_SyncedWorkingTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceDraftId" TEXT,
    "sourceApprovedId" TEXT,
    "workingMerchant" TEXT,
    "description" TEXT,
    "amount" REAL NOT NULL,
    "currency" TEXT,
    "bookingDate" DATETIME NOT NULL,
    "valueDate" DATETIME,
    "category" TEXT,
    "subCategory" TEXT,
    "categoryId" TEXT,
    "subCategoryId" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SyncedWorkingTransaction_sourceDraftId_fkey" FOREIGN KEY ("sourceDraftId") REFERENCES "SyncedDraftTransaction" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SyncedWorkingTransaction_sourceApprovedId_fkey" FOREIGN KEY ("sourceApprovedId") REFERENCES "SyncedApprovedTransaction" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_SyncedWorkingTransaction" ("amount", "bookingDate", "category", "categoryId", "createdAt", "currency", "description", "id", "notes", "sourceApprovedId", "sourceDraftId", "status", "subCategory", "subCategoryId", "updatedAt", "valueDate", "workingMerchant") SELECT "amount", "bookingDate", "category", "categoryId", "createdAt", "currency", "description", "id", "notes", "sourceApprovedId", "sourceDraftId", "status", "subCategory", "subCategoryId", "updatedAt", "valueDate", "workingMerchant" FROM "SyncedWorkingTransaction";
DROP TABLE "SyncedWorkingTransaction";
ALTER TABLE "new_SyncedWorkingTransaction" RENAME TO "SyncedWorkingTransaction";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
