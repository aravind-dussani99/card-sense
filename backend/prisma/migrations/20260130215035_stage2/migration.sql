/*
  Warnings:

  - A unique constraint covering the columns `[userId,providerAccountId]` on the table `BankAccount` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[userId,providerTransactionId]` on the table `BankTransaction` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[userId,name]` on the table `Category` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[userId,providerTxId]` on the table `DraftTransaction` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[userId,merchantKey]` on the table `MerchantCategoryRule` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[userId,providerTxId]` on the table `Transaction` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `userId` to the `BankAccount` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `BankAccountCredential` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `BankTransaction` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `BankTransactionMeta` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `Card` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `CardCredential` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `ChatSession` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `DraftTransaction` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `FromEntity` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `MerchantCategoryRule` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `Offer` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `ProcessedEmail` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `ToEntity` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `Transaction` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "BankAccount_providerAccountId_key";

-- DropIndex
DROP INDEX "BankTransaction_providerTransactionId_key";

-- DropIndex
DROP INDEX "Category_name_key";

-- DropIndex
DROP INDEX "DraftTransaction_providerTxId_key";

-- DropIndex
DROP INDEX "MerchantCategoryRule_merchantKey_key";

-- DropIndex
DROP INDEX "Transaction_providerTxId_key";

-- AlterTable
ALTER TABLE "BankAccount" ADD COLUMN     "userId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "BankAccountCredential" ADD COLUMN     "userId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "BankTransaction" ADD COLUMN     "userId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "BankTransactionMeta" ADD COLUMN     "userId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Card" ADD COLUMN     "userId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "CardCredential" ADD COLUMN     "userId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "userId" TEXT;

-- AlterTable
ALTER TABLE "ChatSession" ADD COLUMN     "userId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "DraftTransaction" ADD COLUMN     "userId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "FromEntity" ADD COLUMN     "userId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "MerchantCategoryRule" ADD COLUMN     "userId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Offer" ADD COLUMN     "userId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "ProcessedEmail" ADD COLUMN     "userId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "ToEntity" ADD COLUMN     "userId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "userId" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "BankAccount_userId_providerAccountId_key" ON "BankAccount"("userId", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "BankTransaction_userId_providerTransactionId_key" ON "BankTransaction"("userId", "providerTransactionId");

-- CreateIndex
CREATE UNIQUE INDEX "Category_userId_name_key" ON "Category"("userId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "DraftTransaction_userId_providerTxId_key" ON "DraftTransaction"("userId", "providerTxId");

-- CreateIndex
CREATE UNIQUE INDEX "MerchantCategoryRule_userId_merchantKey_key" ON "MerchantCategoryRule"("userId", "merchantKey");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_userId_providerTxId_key" ON "Transaction"("userId", "providerTxId");

-- AddForeignKey
ALTER TABLE "Card" ADD CONSTRAINT "Card_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FromEntity" ADD CONSTRAINT "FromEntity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToEntity" ADD CONSTRAINT "ToEntity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DraftTransaction" ADD CONSTRAINT "DraftTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessedEmail" ADD CONSTRAINT "ProcessedEmail_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankConnection" ADD CONSTRAINT "BankConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankAccount" ADD CONSTRAINT "BankAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankTransaction" ADD CONSTRAINT "BankTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankTransactionMeta" ADD CONSTRAINT "BankTransactionMeta_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankAccountCredential" ADD CONSTRAINT "BankAccountCredential_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MerchantCategoryRule" ADD CONSTRAINT "MerchantCategoryRule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatSession" ADD CONSTRAINT "ChatSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardCredential" ADD CONSTRAINT "CardCredential_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
