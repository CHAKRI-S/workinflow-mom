import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission, ROLES } from "@/lib/permissions";

/**
 * GET /api/finance/wht/outstanding
 *
 * List receipts with WHT deducted but cert not yet RECEIVED/VERIFIED,
 * with aging buckets based on issueDate.
 */
export async function GET(_req: NextRequest) {
  try {
    const session = await auth();
    requirePermission(session, ROLES.FINANCE);
    const tenantId = session!.user.tenantId;

    const receipts = await prisma.receipt.findMany({
      where: {
        tenantId,
        status: { not: "CANCELLED" },
        whtCertStatus: { in: ["PENDING", "MISSING_OVERDUE"] },
      },
      orderBy: { issueDate: "asc" },
      include: {
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
            customer: { select: { id: true, code: true, name: true } },
          },
        },
      },
    });

    const now = Date.now();
    const DAY = 24 * 60 * 60 * 1000;

    const items = receipts.map((r) => {
      const ageDays = Math.floor((now - r.issueDate.getTime()) / DAY);
      let bucket: "0_30" | "31_60" | "61_90" | "90_plus";
      if (ageDays <= 30) bucket = "0_30";
      else if (ageDays <= 60) bucket = "31_60";
      else if (ageDays <= 90) bucket = "61_90";
      else bucket = "90_plus";

      return {
        id: r.id,
        receiptNumber: r.receiptNumber,
        issueDate: r.issueDate,
        ageDays,
        bucket,
        grossAmount: r.grossAmount?.toString() ?? null,
        whtAmount: r.whtAmount.toString(),
        whtRate: r.whtRate.toString(),
        whtCertStatus: r.whtCertStatus,
        whtCertNumber: r.whtCertNumber,
        whtCertReceivedAt: r.whtCertReceivedAt,
        payerName: r.payerName,
        invoice: r.invoice
          ? {
              id: r.invoice.id,
              invoiceNumber: r.invoice.invoiceNumber,
              customer: r.invoice.customer,
            }
          : null,
      };
    });

    // Summary per bucket
    const summary = {
      total: items.length,
      totalWhtAmount: 0,
      buckets: {
        "0_30": { count: 0, whtAmount: 0 },
        "31_60": { count: 0, whtAmount: 0 },
        "61_90": { count: 0, whtAmount: 0 },
        "90_plus": { count: 0, whtAmount: 0 },
      } as Record<string, { count: number; whtAmount: number }>,
    };

    for (const it of items) {
      const w = Number(it.whtAmount);
      summary.totalWhtAmount += w;
      summary.buckets[it.bucket].count += 1;
      summary.buckets[it.bucket].whtAmount += w;
    }

    return NextResponse.json({ items, summary });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    console.error("GET /api/finance/wht/outstanding error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
