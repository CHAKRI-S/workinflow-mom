-- CreateTable: PlatformSettings (singleton holding WorkinFlow issuer info)
CREATE TABLE "PlatformSettings" (
    "id" TEXT NOT NULL DEFAULT 'SINGLETON',
    "issuerName" TEXT NOT NULL DEFAULT '',
    "issuerTaxId" TEXT NOT NULL DEFAULT '',
    "issuerAddress" TEXT NOT NULL DEFAULT '',
    "issuerPhone" TEXT NOT NULL DEFAULT '',
    "issuerEmail" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "PlatformSettings_pkey" PRIMARY KEY ("id")
);

-- Seed the singleton row so app code can always upsert it
INSERT INTO "PlatformSettings" ("id", "updatedAt") VALUES ('SINGLETON', NOW())
ON CONFLICT ("id") DO NOTHING;
