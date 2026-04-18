import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSaSession } from "@/lib/sa-auth";
import { createAuditLog } from "@/lib/audit";

// PATCH /api/sa/tenants/:id/extend-trial — extend trial by N days
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const sa = await requireSaSession();
    const { id } = await params;
    const { days } = await req.json();

    const n = Number(days);
    if (!Number.isFinite(n) || n <= 0 || n > 365) {
      return NextResponse.json({ error: "Invalid days (1-365)" }, { status: 400 });
    }

    const tenant = await prisma.tenant.findUnique({ where: { id } });
    if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });

    const now = new Date();
    const base = tenant.trialEndsAt && tenant.trialEndsAt > now ? tenant.trialEndsAt : now;
    const newEnd = new Date(base);
    newEnd.setDate(newEnd.getDate() + n);

    await prisma.tenant.update({
      where: { id },
      data: { trialEndsAt: newEnd, status: "TRIAL" },
    });

    await createAuditLog({
      action: "UPDATE",
      entityType: "Tenant",
      entityId: id,
      entityNumber: tenant.code,
      changes: {
        trialEndsAt: {
          from: tenant.trialEndsAt?.toISOString() ?? null,
          to: newEnd.toISOString(),
        },
      },
      reason: `Trial extended +${n} days by Super Admin (${sa.username})`,
      userId: sa.sub,
      userName: `SA: ${sa.name}`,
      tenantId: id,
    });

    return NextResponse.json({ success: true, trialEndsAt: newEnd });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("SA extend trial error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
