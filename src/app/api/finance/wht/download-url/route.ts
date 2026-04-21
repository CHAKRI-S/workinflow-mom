import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission, ROLES } from "@/lib/permissions";
import { createSignedDownloadUrl, isS3Configured } from "@/lib/s3";

// GET /api/finance/wht/download-url?receiptId=xxx
// Returns a short-lived signed GET URL for the cert file on R2.
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    requirePermission(session, ROLES.FINANCE);

    if (!isS3Configured()) {
      return NextResponse.json(
        { error: "File storage not configured on server" },
        { status: 503 }
      );
    }

    const { searchParams } = new URL(req.url);
    const receiptId = searchParams.get("receiptId");
    if (!receiptId) {
      return NextResponse.json(
        { error: "receiptId required" },
        { status: 400 }
      );
    }

    const tenantId = session!.user.tenantId;
    const receipt = await prisma.receipt.findFirst({
      where: { id: receiptId, tenantId },
      select: {
        id: true,
        receiptNumber: true,
        whtCertFileUrl: true,
        whtCertNumber: true,
      },
    });

    if (!receipt) {
      return NextResponse.json({ error: "Receipt not found" }, { status: 404 });
    }
    if (!receipt.whtCertFileUrl) {
      return NextResponse.json(
        { error: "No cert file on this receipt" },
        { status: 404 }
      );
    }

    // Build a nice download filename
    const ext = extractExt(receipt.whtCertFileUrl);
    const downloadName = `WHT-Cert-${receipt.receiptNumber}${
      receipt.whtCertNumber ? `-${receipt.whtCertNumber}` : ""
    }${ext}`;

    const downloadUrl = await createSignedDownloadUrl({
      key: receipt.whtCertFileUrl,
      expiresInSec: 60 * 10, // 10 min
      filename: downloadName,
    });

    return NextResponse.json({ downloadUrl, filename: downloadName });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    console.error("GET /api/finance/wht/download-url error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

function extractExt(key: string): string {
  const idx = key.lastIndexOf(".");
  if (idx < 0) return "";
  const ext = key.slice(idx).toLowerCase();
  if ([".pdf", ".jpg", ".jpeg", ".png"].includes(ext)) return ext;
  return "";
}
