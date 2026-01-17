-- CreateTable
CREATE TABLE "BankTransactionMeta" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bankTransactionId" TEXT NOT NULL,
    "openingBalance" REAL,
    "fromEntity" TEXT,
    "viaEntity" TEXT,
    "toEntity" TEXT,
    "headAccount" TEXT,
    "subCategory" TEXT,
    "remarks" TEXT,
    "attachmentsJson" TEXT,
    "comments" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BankTransactionMeta_bankTransactionId_fkey" FOREIGN KEY ("bankTransactionId") REFERENCES "BankTransaction" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "BankTransactionMeta_bankTransactionId_key" ON "BankTransactionMeta"("bankTransactionId");
