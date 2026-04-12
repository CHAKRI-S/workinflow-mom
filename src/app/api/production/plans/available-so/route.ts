import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission, ROLES } from "@/lib/permissions";

// GET /api/production/plans/available-so — List schedulable Sales Orders
export async function GET() {
  try {
    const session = await auth();
    requirePermission(session, ROLES.PLANNING);
    const tenantId = session!.user.tenantId;

    const salesOrders = await prisma.salesOrder.findMany({
      where: {
        tenantId,
        status: {
          in: [
            "CONFIRMED",
            "DEPOSIT_PENDING",
            "IN_PRODUCTION",
            "PAINTING",
            "ENGRAVING",
            "QC_FINAL",
            "PACKING",
            "AWAITING_PAYMENT",
          ],
        },
      },
      include: {
        customer: {
          select: { id: true, name: true, code: true },
        },
        lines: {
          include: {
            product: {
              select: { id: true, code: true, name: true },
            },
          },
          orderBy: { sortOrder: "asc" },
        },
      },
      orderBy: { orderDate: "desc" },
    });

    return NextResponse.json(JSON.parse(JSON.stringify(salesOrders)));
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("GET /api/production/plans/available-so error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
