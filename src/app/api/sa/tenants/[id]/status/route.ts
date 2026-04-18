import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSaSession } from "@/lib/sa-auth";
import { createAuditLog } from "@/lib/audit";

const VALID_STATUSES = ["TRIAL", "ACTIVE", "SUSPENDED", "CANCELLED"] as const;
type TenantStatus = typeof VALID_STATUSES[number];

// PATCH /api/sa/tenants/:id/status — change tenant status
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const sa = await requireSaSession();
    const { id } = await params;
    const { status } = await req.json();

    if (!VALID_STATUSES.includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    const newStatus = status as TenantStatus;

    const tenant = await prisma.tenant.findUnique({ where: { id } });
    if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });

    await prisma.tenant.update({
      where: { id },
      data: { status: newStatus },
    });

    await createAuditLog({
      action: "STATUS_CHANGE",
      entityType: "Tenant",
      entityId: id,
      entityNumber: tenant.code,
      changes: { status: { from: tenant.status, to: newStatus } },
      reason: `Status changed by Super Admin (${sa.username})`,
      userId: sa.sub,
      userName: `SA: ${sa.name}`,
      tenantId: id,
    });

    return NextResponse.json({ success: true, status: newStatus });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("SA change status error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
