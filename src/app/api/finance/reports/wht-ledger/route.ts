import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission, ROLES } from "@/lib/permissions";

/**
 * GET /api/finance/reports/wht-ledger?from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * Detailed WHT credit ledger for corporate income tax filing (ภ.ง.ด.50/51).
 * Source: Receipts (non-cancelled) with whtRate > 0 within range.
 *
 * Response:
 *   {
 *     range: { from, to },
 *     totals: { count, totalGross, totalNet, totalWht },
 *     byMonth: [{ ym, count, totalWht }],
 *     byStatus: { PENDING: {...}, RECEIVED: {...}, ... },
 *     entries: [{ receiptNumber, date, payer, taxId, gross, wht, certNumber, status }]
 *   }
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    requirePermission(session, ROLES.FINANCE);
    const tenantId = session!.user.tenantId;

    const { searchParams } = new URL(req.url);
    const fromStr = searchParams.get("from");
    const toStr = searchParams.get("to");

    const now = new Date();
    const from = fromStr
      ? new Date(fromStr + "T00:00:00")
      : new Date(now.getFullYear(), 0, 1);
    const to = toStr
      ? new Date(toStr + "T23:59:59")
      : new Date(now.getFullYear(), 11, 31, 23, 59, 59);

    const receipts = await prisma.receipt.findMany({
      where: {
        tenantId,
        status: { not: "CANCELLED" },
        issueDate: { gte: from, lte: to },
        whtRate: { gt: 0 },
      },
      orderBy: { issueDate: "asc" },
      include: {
        invoice: {
          select: {
            invoiceNumber: true,
            customer: { select: { code: true, name: true } },
          },
        },
      },
    });

    let totalGross = 0;
    let totalNet = 0;
    let totalWht = 0;
    const byMonth: Record<string, { ym: string; count: number; totalWht: number }> =
      {};
    const byStatus: Record<string, { count: number; totalWht: number }> = {};

    const entries = receipts.map((r) => {
      const gross = Number(r.grossAmount ?? r.amount);
      const net = Number(r.amount);
      const wht = Number(r.whtAmount);
      totalGross += gross;
      totalNet += net;
      totalWht += wht;

      const ym = `${r.issueDate.getFullYear()}-${String(
        r.issueDate.getMonth() + 1
      ).padStart(2, "0")}`;
      if (!byMonth[ym]) byMonth[ym] = { ym, count: 0, totalWht: 0 };
      byMonth[ym].count += 1;
      byMonth[ym].totalWht += wht;

      const st = r.whtCertStatus;
      if (!byStatus[st]) byStatus[st] = { count: 0, totalWht: 0 };
      byStatus[st].count += 1;
      byStatus[st].totalWht += wht;

      return {
        id: r.id,
        receiptNumber: r.receiptNumber,
        issueDate: r.issueDate.toISOString(),
        invoiceNumber: r.invoice?.invoiceNumber ?? null,
        customerName:
          r.invoice?.customer?.name ?? r.payerName ?? "",
        customerCode: r.invoice?.customer?.code ?? "",
        payerTaxId: r.payerTaxId,
        grossAmount: round2(gross),
        whtRate: Number(r.whtRate),
        whtAmount: round2(wht),
        netAmount: round2(net),
        whtCertNumber: r.whtCertNumber,
        whtCertReceivedAt: r.whtCertReceivedAt?.toISOString() ?? null,
        whtCertStatus: r.whtCertStatus,
      };
    });

    return NextResponse.json({
      range: { from: from.toISOString(), to: to.toISOString() },
      totals: {
        count: entries.length,
        totalGross: round2(totalGross),
        totalNet: round2(totalNet),
        totalWht: round2(totalWht),
      },
      byMonth: Object.values(byMonth)
        .sort((a, b) => a.ym.localeCompare(b.ym))
        .map((m) => ({ ym: m.ym, count: m.count, totalWht: round2(m.totalWht) })),
      byStatus: Object.fromEntries(
        Object.entries(byStatus).map(([k, v]) => [
          k,
          { count: v.count, totalWht: round2(v.totalWht) },
        ])
      ),
      entries,
    });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    console.error("GET /api/finance/reports/wht-ledger error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
