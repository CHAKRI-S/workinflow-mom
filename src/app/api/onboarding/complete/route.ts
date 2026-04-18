import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission, ROLES } from "@/lib/permissions";

// POST /api/onboarding/complete — mark tenant as onboarded
export async function POST() {
  try {
    const session = await auth();
    requirePermission(session, ROLES.ADMIN_ONLY);
    const tenantId = session!.user.tenantId;

    const tenant = await prisma.tenant.update({
      where: { id: tenantId },
      data: { onboardedAt: new Date() },
    });

    return NextResponse.json({
      success: true,
      onboardedAt: tenant.onboardedAt,
    });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
