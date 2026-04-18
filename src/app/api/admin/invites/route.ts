import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission, ROLES } from "@/lib/permissions";
import { requireSeatAvailable, planLimitResponse } from "@/lib/plan-limits";
import { sendUserInviteEmail } from "@/lib/email";
import { Role } from "@/generated/prisma/client";

const INVITE_EXPIRES_DAYS = 7;

const schema = z.object({
  email: z.email(),
  name: z.string().min(1).max(100),
  role: z.enum(["ADMIN", "MANAGER", "PLANNER", "SALES", "OPERATOR", "QC", "ACCOUNTING"]),
});

// GET /api/admin/invites — list all invites for this tenant
export async function GET() {
  try {
    const session = await auth();
    requirePermission(session, ROLES.ADMIN_ONLY);
    const tenantId = session!.user.tenantId;

    const invites = await prisma.userInvite.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return NextResponse.json({ invites });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// POST /api/admin/invites — create new invite
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    requirePermission(session, ROLES.ADMIN_ONLY);
    const tenantId = session!.user.tenantId;

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
    }
    const { email, name, role } = parsed.data;
    const normalizedEmail = email.toLowerCase();

    // Check email not already in use globally
    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      return NextResponse.json({ error: "อีเมลนี้ถูกใช้แล้ว" }, { status: 409 });
    }

    // Check there's no active (unexpired, not accepted) invite for same email+tenant
    const now = new Date();
    const activeInvite = await prisma.userInvite.findFirst({
      where: {
        tenantId,
        email: normalizedEmail,
        acceptedAt: null,
        cancelledAt: null,
        expiresAt: { gt: now },
      },
    });
    if (activeInvite) {
      return NextResponse.json({ error: "มี invite ที่ยังไม่หมดอายุสำหรับอีเมลนี้" }, { status: 409 });
    }

    // Plan seat limit check (count as seat even before accept)
    await requireSeatAvailable(tenantId);

    // Lookup tenant + inviter info
    const [tenant, inviter] = await Promise.all([
      prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true } }),
      prisma.user.findUnique({ where: { id: session!.user.id }, select: { name: true } }),
    ]);
    if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });

    const token = crypto.randomBytes(32).toString("base64url");
    const expiresAt = new Date(now);
    expiresAt.setDate(expiresAt.getDate() + INVITE_EXPIRES_DAYS);

    const invite = await prisma.userInvite.create({
      data: {
        token,
        email: normalizedEmail,
        name,
        role: role as Role,
        tenantId,
        invitedById: session!.user.id,
        invitedByName: inviter?.name ?? "Admin",
        expiresAt,
      },
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://mom.workinflow.cloud";
    const acceptUrl = `${appUrl}/th/invite/${token}`;

    sendUserInviteEmail(normalizedEmail, {
      inviteeName: name,
      inviterName: inviter?.name ?? "Admin",
      companyName: tenant.name,
      role,
      acceptUrl,
      expiresInDays: INVITE_EXPIRES_DAYS,
    }).catch((e) => console.error("invite email error:", e));

    return NextResponse.json(
      {
        success: true,
        invite: {
          id: invite.id,
          email: invite.email,
          name: invite.name,
          role: invite.role,
          expiresAt: invite.expiresAt,
          acceptUrl,
        },
      },
      { status: 201 },
    );
  } catch (err) {
    const limitRes = planLimitResponse(err);
    if (limitRes) return limitRes;
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    console.error("POST /api/admin/invites error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
