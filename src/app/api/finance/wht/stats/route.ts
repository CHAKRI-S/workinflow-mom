import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission, ROLES } from "@/lib/permissions";

/**
 * GET /api/finance/wht/stats?year=YYYY
 *
 * Returns WHT credit summary for the given tax year (default = current year, Gregorian).
 * Used for ภ.ง.ด.50/51 corporate tax credit reconciliation.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    requirePermission(session, ROLES.FINANCE);
    const tenantId = session!.user.tenantId;

    const { searchParams } = new URL(req.url);
    const yearStr = searchParams.get("year");
    const year = yearStr ? Number(yearStr) : new Date().getFullYear();

    const yearStart = new Date(year, 0, 1);
    const yearEnd = new Date(year + 1, 0, 1);

    const receipts = await prisma.receipt.findMany({
      where: {
        tenantId,
        status: { not: "CANCELLED" },
        issueDate: { gte: yearStart, lt: yearEnd },
        whtRate: { gt: 0 },
      },
      select: {
        id: true,
        whtAmount: true,
        whtRate: true,
        grossAmount: true,
        amount: true,
        whtCertStatus: true,
        issueDate: true,
      },
    });

    // Aggregates
    let totalWhtAmount = 0;
    let totalGross = 0;
    let totalNet = 0;
    const byStatus: Record<string, { count: number; whtAmount: number }> = {};
    const byMonth: Array<{ month: number; whtAmount: number; count: number }> =
      Array.from({ length: 12 }, (_, i) => ({
        month: i + 1,
        whtAmount: 0,
        count: 0,
      }));

    for (const r of receipts) {
      const wht = Number(r.whtAmount);
      totalWhtAmount += wht;
      totalGross += Number(r.grossAmount ?? 0);
      totalNet += Number(r.amount);

      const key = r.whtCertStatus;
      if (!byStatus[key]) byStatus[key] = { count: 0, whtAmount: 0 };
      byStatus[key].count += 1;
      byStatus[key].whtAmount += wht;

      const m = r.issueDate.getMonth();
      byMonth[m].whtAmount += wht;
      byMonth[m].count += 1;
    }

    return NextResponse.json({
      year,
      totalCount: receipts.length,
      totalGross: Math.round(totalGross * 100) / 100,
      totalNet: Math.round(totalNet * 100) / 100,
      totalWhtAmount: Math.round(totalWhtAmount * 100) / 100,
      byStatus,
      byMonth: byMonth.map((m) => ({
        month: m.month,
        count: m.count,
        whtAmount: Math.round(m.whtAmount * 100) / 100,
      })),
    });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    console.error("GET /api/finance/wht/stats error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
