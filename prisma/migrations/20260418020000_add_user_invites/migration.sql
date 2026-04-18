-- CreateTable
CREATE TABLE "UserInvite" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "role" "Role" NOT NULL DEFAULT 'OPERATOR',
    "tenantId" TEXT NOT NULL,
    "invitedById" TEXT NOT NULL,
    "invitedByName" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "acceptedUserId" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserInvite_token_key" ON "UserInvite"("token");

-- CreateIndex
CREATE INDEX "UserInvite_tenantId_acceptedAt_idx" ON "UserInvite"("tenantId", "acceptedAt");

-- CreateIndex
CREATE INDEX "UserInvite_email_idx" ON "UserInvite"("email");
