-- Create working copy table seeded from raw sync rows. Adjust references as needed.
CREATE TABLE "SyncedWorkingTransaction" (
    "id" TEXT PRIMARY KEY NOT NULL,
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
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SyncedWorkingTransaction_sourceDraftId_fkey" FOREIGN KEY ("sourceDraftId") REFERENCES "SyncedDraftTransaction" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SyncedWorkingTransaction_sourceApprovedId_fkey" FOREIGN KEY ("sourceApprovedId") REFERENCES "SyncedApprovedTransaction" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- Seed existing draft rows into working copies with workingMerchant from description/merchantActual.
INSERT INTO "SyncedWorkingTransaction" (
    "id", "sourceDraftId", "workingMerchant", "description", "amount", "currency", "bookingDate", "valueDate", "category", "subCategory", "categoryId", "subCategoryId", "notes", "status", "createdAt", "updatedAt"
) SELECT
    'wk-' || "id",
    "id",
    COALESCE("merchantActual", "descriptionVia", "description", "reference"),
    COALESCE("descriptionVia", "description", "reference"),
    "amount",
    "currency",
    "bookingDate",
    "valueDate",
    "category",
    "subCategory",
    "categoryId",
    "subCategoryId",
    "notes",
    'active',
    COALESCE("updatedAt", CURRENT_TIMESTAMP),
    COALESCE("updatedAt", CURRENT_TIMESTAMP)
FROM "SyncedDraftTransaction";
