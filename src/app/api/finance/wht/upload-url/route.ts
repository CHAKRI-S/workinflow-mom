import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission, ROLES } from "@/lib/permissions";
import {
  buildWhtCertKey,
  createSignedUploadUrl,
  isAllowedMime,
  isS3Configured,
  MAX_WHT_CERT_BYTES,
} from "@/lib/s3";
import { z } from "zod";

const bodySchema = z.object({
  receiptId: z.string().min(1),
  filename: z.string().min(1).max(255),
  contentType: z.string().min(1),
  sizeBytes: z.number().int().positive(),
});

// POST /api/finance/wht/upload-url
// Returns a pre-signed PUT URL to upload directly to R2.
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    requirePermission(session, ROLES.FINANCE);

    if (!isS3Configured()) {
      return NextResponse.json(
        { error: "File storage not configured on server" },
        { status: 503 }
      );
    }

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { receiptId, filename, contentType, sizeBytes } = parsed.data;

    if (!isAllowedMime(contentType)) {
      return NextResponse.json(
        {
          error: "File type not allowed. Use PDF, JPG, or PNG.",
        },
        { status: 400 }
      );
    }

    if (sizeBytes > MAX_WHT_CERT_BYTES) {
      return NextResponse.json(
        {
          error: `File too large. Max ${Math.round(MAX_WHT_CERT_BYTES / (1024 * 1024))} MB.`,
        },
        { status: 400 }
      );
    }

    // Verify receipt belongs to tenant
    const tenantId = session!.user.tenantId;
    const receipt = await prisma.receipt.findFirst({
      where: { id: receiptId, tenantId },
      select: { id: true },
    });
    if (!receipt) {
      return NextResponse.json({ error: "Receipt not found" }, { status: 404 });
    }

    const key = buildWhtCertKey({
      tenantId,
      receiptId,
      originalFilename: filename,
    });

    const uploadUrl = await createSignedUploadUrl({
      key,
      contentType,
      expiresInSec: 60 * 10, // 10 min to complete upload
    });

    return NextResponse.json({ uploadUrl, key });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    console.error("POST /api/finance/wht/upload-url error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
