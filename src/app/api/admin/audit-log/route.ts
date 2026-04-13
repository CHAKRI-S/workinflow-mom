import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission, ROLES } from "@/lib/permissions";

// GET /api/admin/audit-log — list audit logs
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    requirePermission(session, ROLES.MANAGEMENT);
    const tenantId = session!.user.tenantId;

    const { searchParams } = new URL(req.url);
    const entityType = searchParams.get("entityType");
    const entityId = searchParams.get("entityId");
    const limit = parseInt(searchParams.get("limit") || "50");

    const where: Record<string, unknown> = { tenantId };
    if (entityType) where.entityType = entityType;
    if (entityId) where.entityId = entityId;

    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: Math.min(limit, 200),
    });

    return NextResponse.json(logs);
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
