import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission, ROLES } from "@/lib/permissions";

/**
 * DELETE /api/admin/invites/:id — cancel an invite (not revoke after accept)
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    requirePermission(session, ROLES.ADMIN_ONLY);
    const tenantId = session!.user.tenantId;

    const { id } = await params;
    const invite = await prisma.userInvite.findUnique({ where: { id } });
    if (!invite || invite.tenantId !== tenantId) {
      return NextResponse.json({ error: "Invite not found" }, { status: 404 });
    }
    if (invite.acceptedAt) {
      return NextResponse.json({ error: "ยอมรับแล้ว ลบไม่ได้" }, { status: 400 });
    }

    await prisma.userInvite.update({
      where: { id },
      data: { cancelledAt: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
