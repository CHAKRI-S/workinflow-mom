import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission, ROLES } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import { z } from "zod";
import type { SalesOrderStatus } from "@/generated/prisma/client";

type Params = { params: Promise<{ id: string }> };

// Valid status transitions
const VALID_TRANSITIONS: Record<string, string[]> = {
  CONFIRMED: ["DEPOSIT_PENDING", "IN_PRODUCTION", "CANCELLED"],
  DEPOSIT_PENDING: ["IN_PRODUCTION", "CANCELLED"],
  IN_PRODUCTION: ["PAINTING", "ENGRAVING", "QC_FINAL", "PACKING", "CANCELLED"],
  PAINTING: ["ENGRAVING", "QC_FINAL", "CANCELLED"],
  ENGRAVING: ["QC_FINAL", "CANCELLED"],
  QC_FINAL: ["PACKING", "CANCELLED"],
  PACKING: ["AWAITING_PAYMENT", "SHIPPED", "CANCELLED"],
  AWAITING_PAYMENT: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["COMPLETED", "CANCELLED"],
};

const statusChangeSchema = z.object({
  status: z.enum([
    "CONFIRMED",
    "DEPOSIT_PENDING",
    "IN_PRODUCTION",
    "PAINTING",
    "ENGRAVING",
    "QC_FINAL",
    "PACKING",
    "AWAITING_PAYMENT",
    "SHIPPED",
    "COMPLETED",
    "CANCELLED",
  ]),
});

// PATCH /api/sales/orders/[id]/status — change status
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    requirePermission(session, ROLES.SALES_TEAM);
    const { id } = await params;
    const tenantId = session!.user.tenantId;

    const body = await req.json();
    const { status: newStatus } = statusChangeSchema.parse(body);

    const order = await prisma.salesOrder.findFirst({
      where: { id, tenantId },
    });

    if (!order) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const currentStatus = order.status;

    // CANCELLED and COMPLETED are terminal
    if (currentStatus === "CANCELLED" || currentStatus === "COMPLETED") {
      return NextResponse.json(
        { error: `Cannot transition from ${currentStatus}` },
        { status: 400 }
      );
    }

    // Any status can go to CANCELLED
    if (newStatus === "CANCELLED") {
      const updated = await prisma.salesOrder.update({
        where: { id },
        data: { status: "CANCELLED" as SalesOrderStatus },
      });

      await createAuditLog({
        action: "CANCEL",
        entityType: "SalesOrder",
        entityId: id,
        entityNumber: order.orderNumber,
        changes: { status: { from: currentStatus, to: "CANCELLED" } },
        userId: session!.user.id,
        userName: session!.user.name || "",
        tenantId,
      });

      return NextResponse.json(JSON.parse(JSON.stringify(updated)));
    }

    // Validate transition
    const allowed = VALID_TRANSITIONS[currentStatus] || [];
    if (!allowed.includes(newStatus)) {
      return NextResponse.json(
        {
          error: `Invalid transition: ${currentStatus} -> ${newStatus}`,
          allowedTransitions: allowed,
        },
        { status: 400 }
      );
    }

    // When transitioning to DEPOSIT_PENDING, require depositPercent > 0
    if (newStatus === "DEPOSIT_PENDING") {
      if (!order.depositPercent || Number(order.depositPercent) <= 0) {
        return NextResponse.json(
          { error: "Deposit percent must be > 0 to move to DEPOSIT_PENDING" },
          { status: 400 }
        );
      }
    }

    const updated = await prisma.salesOrder.update({
      where: { id },
      data: { status: newStatus as SalesOrderStatus },
    });

    await createAuditLog({
      action: "STATUS_CHANGE",
      entityType: "SalesOrder",
      entityId: id,
      entityNumber: order.orderNumber,
      changes: { status: { from: currentStatus, to: newStatus } },
      userId: session!.user.id,
      userName: session!.user.name || "",
      tenantId,
    });

    return NextResponse.json(JSON.parse(JSON.stringify(updated)));
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    if (err instanceof Error && err.name === "ZodError") {
      return NextResponse.json({ error: "Invalid status value" }, { status: 400 });
    }
    console.error("PATCH /api/sales/orders/[id]/status error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
