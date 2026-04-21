import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission, ROLES } from "@/lib/permissions";

/**
 * GET /api/finance/reports/drawing-source-mix?from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * Classifies revenue by the ORIGIN OF THE DRAWING (TENANT_OWNED vs
 * CUSTOMER_PROVIDED vs JOINT_DEVELOPMENT). Strategic report: a rising
 * share of CUSTOMER_PROVIDED lines is a signal that the business is
 * drifting from OEM-goods manufacturer toward contract-service provider
 * — which has tax implications (WHT exposure) and IP/strategy implications.
 *
 * Source: InvoiceLine joined to Invoice within range, excluding DRAFT + CANCELLED.
 *
 * Response:
 *   {
 *     range,
 *     byDrawing: [{ drawingSource, lineCount, invoiceCount, revenue, share }],
 *     grandTotal: { lineCount, revenue },
 *     topCustomersByCustomerDrawing: [{ customerId, name, revenue }]
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

    const lines = await prisma.invoiceLine.findMany({
      where: {
        invoice: {
          tenantId,
          status: {
            in: ["ISSUED", "SENT", "PARTIALLY_PAID", "PAID", "OVERDUE"],
          },
          issueDate: { gte: from, lte: to },
        },
      },
      select: {
        invoiceId: true,
        drawingSource: true,
        lineTotal: true,
        invoice: {
          select: {
            customerId: true,
            customer: { select: { code: true, name: true } },
          },
        },
      },
    });

    type Source = "TENANT_OWNED" | "CUSTOMER_PROVIDED" | "JOINT_DEVELOPMENT";
    const stats: Record<
      Source,
      { lineCount: number; invoiceIds: Set<string>; revenue: number }
    > = {
      TENANT_OWNED: { lineCount: 0, invoiceIds: new Set(), revenue: 0 },
      CUSTOMER_PROVIDED: { lineCount: 0, invoiceIds: new Set(), revenue: 0 },
      JOINT_DEVELOPMENT: { lineCount: 0, invoiceIds: new Set(), revenue: 0 },
    };

    const customerDrawingByCust: Record<
      string,
      { customerId: string; code: string; name: string; revenue: number }
    > = {};

    let grandRevenue = 0;
    let grandLines = 0;

    for (const l of lines) {
      const src = l.drawingSource as Source;
      const amt = Number(l.lineTotal);
      stats[src].lineCount += 1;
      stats[src].invoiceIds.add(l.invoiceId);
      stats[src].revenue += amt;
      grandRevenue += amt;
      grandLines += 1;

      if (src === "CUSTOMER_PROVIDED" && l.invoice.customer) {
        const cid = l.invoice.customerId;
        if (!customerDrawingByCust[cid]) {
          customerDrawingByCust[cid] = {
            customerId: cid,
            code: l.invoice.customer.code,
            name: l.invoice.customer.name,
            revenue: 0,
          };
        }
        customerDrawingByCust[cid].revenue += amt;
      }
    }

    const byDrawing = (Object.keys(stats) as Source[]).map((k) => ({
      drawingSource: k,
      lineCount: stats[k].lineCount,
      invoiceCount: stats[k].invoiceIds.size,
      revenue: round2(stats[k].revenue),
      share:
        grandRevenue > 0 ? round2((stats[k].revenue / grandRevenue) * 100) : 0,
    }));

    const topCustomersByCustomerDrawing = Object.values(customerDrawingByCust)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10)
      .map((c) => ({ ...c, revenue: round2(c.revenue) }));

    return NextResponse.json({
      range: { from: from.toISOString(), to: to.toISOString() },
      byDrawing,
      grandTotal: {
        lineCount: grandLines,
        revenue: round2(grandRevenue),
      },
      topCustomersByCustomerDrawing,
    });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    console.error("GET /api/finance/reports/drawing-source-mix error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
