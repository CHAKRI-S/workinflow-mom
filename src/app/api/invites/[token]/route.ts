import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/invites/:token — public: preview invite details for invitee
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const invite = await prisma.userInvite.findUnique({ where: { token } });

    if (!invite) {
      return NextResponse.json({ error: "Invite not found" }, { status: 404 });
    }
    if (invite.cancelledAt) {
      return NextResponse.json({ error: "Invite ถูกยกเลิกแล้ว" }, { status: 410 });
    }
    if (invite.acceptedAt) {
      return NextResponse.json({ error: "Invite นี้ถูกใช้ไปแล้ว" }, { status: 410 });
    }
    if (invite.expiresAt < new Date()) {
      return NextResponse.json({ error: "Invite หมดอายุแล้ว" }, { status: 410 });
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: invite.tenantId },
      select: { name: true },
    });

    return NextResponse.json({
      email: invite.email,
      name: invite.name,
      role: invite.role,
      companyName: tenant?.name,
      invitedByName: invite.invitedByName,
      expiresAt: invite.expiresAt,
    });
  } catch (err) {
    console.error("GET invite error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
