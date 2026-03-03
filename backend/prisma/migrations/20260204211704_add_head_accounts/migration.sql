-- AlterTable
ALTER TABLE "BankAccount" ADD COLUMN     "statementBalance" DOUBLE PRECISION,
ADD COLUMN     "statementDate" TIMESTAMP(3),
ADD COLUMN     "statementDueDate" TIMESTAMP(3),
ADD COLUMN     "statementPaidAmount" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "HeadAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HeadAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HeadAccount_userId_name_key" ON "HeadAccount"("userId", "name");

-- AddForeignKey
ALTER TABLE "HeadAccount" ADD CONSTRAINT "HeadAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
