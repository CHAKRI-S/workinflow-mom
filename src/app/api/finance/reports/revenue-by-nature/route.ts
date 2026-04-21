import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission, ROLES } from "@/lib/permissions";

/**
 * GET /api/finance/reports/revenue-by-nature?from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * Revenue breakdown grouped by `billingNature` (GOODS / MANUFACTURING_SERVICE / MIXED).
 * Source: Invoices with status in (ISSUED, SENT, PARTIALLY_PAID, PAID, OVERDUE).
 * Cancelled + Draft are excluded.
 *
 * Response:
 *   {
 *     range: { from, to },
 *     byNature: [{ billingNature, count, total, share }],
 *     monthlyTrend: [{ ym, GOODS, MANUFACTURING_SERVICE, MIXED }],
 *     grandTotal: number,
 *     grandCount: number,
 *     invoices: [{ id, invoiceNumber, ... }] // for drill-down table + CSV
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

    const invoices = await prisma.invoice.findMany({
      where: {
        tenantId,
        status: {
          in: ["ISSUED", "SENT", "PARTIALLY_PAID", "PAID", "OVERDUE"],
        },
        issueDate: { gte: from, lte: to },
      },
      select: {
        id: true,
        invoiceNumber: true,
        issueDate: true,
        billingNature: true,
        totalAmount: true,
        status: true,
        customer: { select: { id: true, code: true, name: true } },
      },
      orderBy: { issueDate: "asc" },
    });

    type Nature = "GOODS" | "MANUFACTURING_SERVICE" | "MIXED";
    const totals: Record<Nature, { count: number; total: number }> = {
      GOODS: { count: 0, total: 0 },
      MANUFACTURING_SERVICE: { count: 0, total: 0 },
      MIXED: { count: 0, total: 0 },
    };

    // Monthly trend bucket — key = YYYY-MM
    const trend: Record<
      string,
      { ym: string; GOODS: number; MANUFACTURING_SERVICE: number; MIXED: number }
    > = {};

    let grandTotal = 0;

    for (const inv of invoices) {
      const nature = inv.billingNature as Nature;
      const amt = Number(inv.totalAmount);
      totals[nature].count += 1;
      totals[nature].total += amt;
      grandTotal += amt;

      const ym = `${inv.issueDate.getFullYear()}-${String(
        inv.issueDate.getMonth() + 1
      ).padStart(2, "0")}`;
      if (!trend[ym]) {
        trend[ym] = { ym, GOODS: 0, MANUFACTURING_SERVICE: 0, MIXED: 0 };
      }
      trend[ym][nature] += amt;
    }

    const byNature = (Object.keys(totals) as Nature[]).map((k) => ({
      billingNature: k,
      count: totals[k].count,
      total: round2(totals[k].total),
      share: grandTotal > 0 ? round2((totals[k].total / grandTotal) * 100) : 0,
    }));

    const monthlyTrend = Object.values(trend)
      .sort((a, b) => a.ym.localeCompare(b.ym))
      .map((t) => ({
        ym: t.ym,
        GOODS: round2(t.GOODS),
        MANUFACTURING_SERVICE: round2(t.MANUFACTURING_SERVICE),
        MIXED: round2(t.MIXED),
      }));

    return NextResponse.json({
      range: {
        from: from.toISOString(),
        to: to.toISOString(),
      },
      byNature,
      monthlyTrend,
      grandTotal: round2(grandTotal),
      grandCount: invoices.length,
      invoices: invoices.map((inv) => ({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        issueDate: inv.issueDate.toISOString(),
        billingNature: inv.billingNature,
        status: inv.status,
        totalAmount: round2(Number(inv.totalAmount)),
        customerName: inv.customer.name,
        customerCode: inv.customer.code,
      })),
    });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    console.error("GET /api/finance/reports/revenue-by-nature error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
