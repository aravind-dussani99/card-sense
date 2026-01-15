-- Add product metadata columns to cards
ALTER TABLE "Card" ADD COLUMN "productCode" TEXT;
ALTER TABLE "Card" ADD COLUMN "planName" TEXT;
ALTER TABLE "Card" ADD COLUMN "benefitsJson" TEXT;
ALTER TABLE "Card" ADD COLUMN "tags" TEXT;

-- Add product metadata columns to bank accounts
ALTER TABLE "BankAccount" ADD COLUMN "productCode" TEXT;
ALTER TABLE "BankAccount" ADD COLUMN "planName" TEXT;
ALTER TABLE "BankAccount" ADD COLUMN "benefitsJson" TEXT;
ALTER TABLE "BankAccount" ADD COLUMN "tags" TEXT;
