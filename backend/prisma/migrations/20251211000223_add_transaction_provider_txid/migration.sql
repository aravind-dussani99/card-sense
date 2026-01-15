/*
  Warnings:

  - A unique constraint covering the columns `[providerTxId]` on the table `Transaction` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN "providerTxId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_providerTxId_key" ON "Transaction"("providerTxId");
