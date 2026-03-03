/*
  Warnings:

  - A unique constraint covering the columns `[userId,emailId]` on the table `DraftTransaction` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[userId,name]` on the table `FromEntity` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[userId,emailId]` on the table `Offer` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[userId,emailId]` on the table `ProcessedEmail` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[userId,name]` on the table `ToEntity` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "DraftTransaction_emailId_key";

-- DropIndex
DROP INDEX "FromEntity_name_key";

-- DropIndex
DROP INDEX "Offer_emailId_key";

-- DropIndex
DROP INDEX "ProcessedEmail_emailId_key";

-- DropIndex
DROP INDEX "ToEntity_name_key";

-- CreateIndex
CREATE UNIQUE INDEX "DraftTransaction_userId_emailId_key" ON "DraftTransaction"("userId", "emailId");

-- CreateIndex
CREATE UNIQUE INDEX "FromEntity_userId_name_key" ON "FromEntity"("userId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Offer_userId_emailId_key" ON "Offer"("userId", "emailId");

-- CreateIndex
CREATE UNIQUE INDEX "ProcessedEmail_userId_emailId_key" ON "ProcessedEmail"("userId", "emailId");

-- CreateIndex
CREATE UNIQUE INDEX "ToEntity_userId_name_key" ON "ToEntity"("userId", "name");
