/*
  Warnings:

  - A unique constraint covering the columns `[providerAccountId]` on the table `BankAccount` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "BankAccount_providerAccountId_key" ON "BankAccount"("providerAccountId");
