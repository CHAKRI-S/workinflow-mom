import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSaSession } from "@/lib/sa-auth";
import { createAuditLog } from "@/lib/audit";

// PATCH /api/sa/tenants/:id/plan — change tenant's plan
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const sa = await requireSaSession();
    const { id } = await params;
    const { planId } = await req.json();

    if (!planId || typeof planId !== "string") {
      return NextResponse.json({ error: "planId required" }, { status: 400 });
    }

    const [tenant, plan] = await Promise.all([
      prisma.tenant.findUnique({ where: { id }, include: { plan: true } }),
      prisma.plan.findUnique({ where: { id: planId } }),
    ]);

    if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    if (!plan) return NextResponse.json({ error: "Plan not found" }, { status: 404 });

    await prisma.tenant.update({
      where: { id },
      data: { planId: plan.id },
    });

    // Audit log
    await createAuditLog({
      action: "UPDATE",
      entityType: "Tenant",
      entityId: id,
      entityNumber: tenant.code,
      changes: {
        plan: {
          from: tenant.plan?.name ?? null,
          to: plan.name,
        },
      },
      reason: `Plan changed by Super Admin (${sa.username})`,
      userId: sa.sub,
      userName: `SA: ${sa.name}`,
      tenantId: id,
    });

    return NextResponse.json({ success: true, plan: { id: plan.id, name: plan.name } });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("SA change plan error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
