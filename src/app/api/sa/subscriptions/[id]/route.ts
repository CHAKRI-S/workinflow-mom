import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSaSession } from "@/lib/sa-auth";
import { createSignedDownloadUrl, isS3Configured } from "@/lib/s3";

// GET /api/sa/subscriptions/:id — detail
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireSaSession();
    const { id } = await params;

    const sub = await prisma.subscription.findUnique({
      where: { id },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true,
            code: true,
            status: true,
            email: true,
            taxId: true,
            branchNo: true,
            address: true,
          },
        },
        plan: {
          select: {
            id: true,
            name: true,
            tier: true,
            slug: true,
            priceMonthly: true,
            priceYearly: true,
          },
        },
        discountCode: {
          select: {
            id: true,
            code: true,
            description: true,
            discountType: true,
            discountValue: true,
          },
        },
        invoices: {
          orderBy: { issueDate: "desc" },
          select: {
            id: true,
            invoiceNumber: true,
            issueDate: true,
            paidAt: true,
            subtotalSatang: true,
            discountSatang: true,
            vatSatang: true,
            totalSatang: true,
            pdfUrl: true,
          },
        },
      },
    });

    if (!sub) {
      return NextResponse.json({ error: "Subscription not found" }, { status: 404 });
    }

    // Signed URL for the uploaded transfer slip / proof (private R2 bucket).
    let slipDownloadUrl: string | null = null;
    if (sub.slipUrl && isS3Configured()) {
      try {
        slipDownloadUrl = await createSignedDownloadUrl({ key: sub.slipUrl });
      } catch (e) {
        console.error("[sa/subscriptions] signed slip url failed:", e);
      }
    }

    // Resolve the confirming super admin's name for display.
    let confirmedByName: string | null = null;
    if (sub.confirmedBySaId) {
      const saUser = await prisma.superAdmin.findUnique({
        where: { id: sub.confirmedBySaId },
        select: { name: true, username: true },
      });
      confirmedByName = saUser ? saUser.name || saUser.username : null;
    }

    return NextResponse.json({ subscription: sub, slipDownloadUrl, confirmedByName });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("SA subscription detail error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
