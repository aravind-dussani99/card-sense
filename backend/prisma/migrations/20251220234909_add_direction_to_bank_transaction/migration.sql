/*
  Warnings:

  - You are about to drop the `SyncedApprovedTransaction` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `SyncedDraftTransaction` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `SyncedWorkingTransaction` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterTable
ALTER TABLE "BankTransaction" ADD COLUMN "direction" TEXT DEFAULT 'debit';

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "SyncedApprovedTransaction";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "SyncedDraftTransaction";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "SyncedWorkingTransaction";
PRAGMA foreign_keys=on;
