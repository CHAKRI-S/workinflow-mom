-- AlterTable
ALTER TABLE "PlatformSettings" ADD COLUMN     "bankAccountName" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "bankAccountNumber" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "bankBranch" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "bankName" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "promptPayId" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "confirmedAt" TIMESTAMP(3),
ADD COLUMN     "confirmedBySaId" TEXT,
ADD COLUMN     "manualNote" TEXT,
ADD COLUMN     "slipSubmittedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "TelegramChat" (
    "id" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT '',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TelegramChat_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TelegramChat_chatId_key" ON "TelegramChat"("chatId");
