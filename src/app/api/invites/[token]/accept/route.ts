import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireSeatAvailable, planLimitResponse } from "@/lib/plan-limits";

const schema = z.object({
  name: z.string().min(1).max(100).optional(),
  password: z.string().min(8, "รหัสผ่านต้องมีอย่างน้อย 8 ตัว"),
});

/**
 * POST /api/invites/:token/accept — create user + mark invite accepted
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
    }
    const { name, password } = parsed.data;

    const invite = await prisma.userInvite.findUnique({ where: { token } });
    if (!invite) return NextResponse.json({ error: "Invite not found" }, { status: 404 });
    if (invite.cancelledAt) {
      return NextResponse.json({ error: "Invite ถูกยกเลิกแล้ว" }, { status: 410 });
    }
    if (invite.acceptedAt) {
      return NextResponse.json({ error: "Invite นี้ถูกใช้ไปแล้ว" }, { status: 410 });
    }
    if (invite.expiresAt < new Date()) {
      return NextResponse.json({ error: "Invite หมดอายุแล้ว" }, { status: 410 });
    }

    // Double-check email still not used (race condition guard)
    const existing = await prisma.user.findUnique({ where: { email: invite.email } });
    if (existing) {
      return NextResponse.json({ error: "อีเมลนี้ถูกใช้แล้ว" }, { status: 409 });
    }

    // Re-check seat limit at accept time
    await requireSeatAvailable(invite.tenantId);

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email: invite.email,
          name: name || invite.name || invite.email.split("@")[0],
          hashedPassword,
          role: invite.role,
          tenantId: invite.tenantId,
          emailVerifiedAt: new Date(), // invite link proves ownership
        },
      });
      await tx.userInvite.update({
        where: { id: invite.id },
        data: { acceptedAt: new Date(), acceptedUserId: newUser.id },
      });
      return newUser;
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://mom.workinflow.cloud";
    return NextResponse.json({
      success: true,
      userId: user.id,
      email: user.email,
      loginUrl: `${appUrl}/th/login`,
    });
  } catch (err) {
    const limitRes = planLimitResponse(err);
    if (limitRes) return limitRes;
    console.error("accept invite error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
