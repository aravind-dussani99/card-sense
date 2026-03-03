-- Add balance fields to AccountMeta
ALTER TABLE "AccountMeta" ADD COLUMN "balance" DOUBLE PRECISION;
ALTER TABLE "AccountMeta" ADD COLUMN "availableBalance" DOUBLE PRECISION;
ALTER TABLE "AccountMeta" ADD COLUMN "limit" DOUBLE PRECISION;
