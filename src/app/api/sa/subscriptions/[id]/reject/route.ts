import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSaSession } from "@/lib/sa-auth";
import { createAuditLog } from "@/lib/audit";

/**
 * POST /api/sa/subscriptions/:id/reject
 * Super admin rejects a pending bank-transfer payment (e.g. slip invalid /
 * amount short). Body: { note?: string }.
 *
 * Marks the subscription CANCELLED with the reason recorded. Only PENDING
 * subscriptions can be rejected. Does not touch the tenant's current plan.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sa = await requireSaSession();
    const { id } = await params;

    let note = "";
    try {
      const body = await req.json();
      if (body && typeof body.note === "string") note = body.note.trim().slice(0, 500);
    } catch {
      // no body is fine
    }

    const sub = await prisma.subscription.findUnique({
      where: { id },
      select: { id: true, status: true, tenantId: true, tenant: { select: { code: true } } },
    });
    if (!sub) {
      return NextResponse.json({ error: "Subscription not found" }, { status: 404 });
    }
    if (sub.status !== "PENDING") {
      return NextResponse.json(
        { error: `ปฏิเสธได้เฉพาะรายการที่รอชำระ (สถานะปัจจุบัน: ${sub.status})` },
        { status: 400 }
      );
    }

    await prisma.subscription.update({
      where: { id: sub.id },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
        cancelReason: note || "ปฏิเสธโดยผู้ดูแลระบบ",
        ...(note ? { manualNote: note } : {}),
      },
    });

    await createAuditLog({
      action: "CANCEL",
      entityType: "Subscription",
      entityId: sub.id,
      changes: { status: { from: "PENDING", to: "CANCELLED" } },
      reason: `Bank-transfer rejected by Super Admin (${sa.username})${note ? ` — ${note}` : ""}`,
      userId: sa.sub,
      userName: `SA: ${sa.name}`,
      tenantId: sub.tenantId,
    });

    return NextResponse.json({ success: true, status: "CANCELLED" });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("SA reject subscription error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
