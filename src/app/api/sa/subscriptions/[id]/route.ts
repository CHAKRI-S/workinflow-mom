import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSaSession } from "@/lib/sa-auth";

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

    return NextResponse.json({ subscription: sub });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("SA subscription detail error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
