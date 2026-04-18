import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { sendPasswordResetEmail } from "@/lib/email";

const schema = z.object({ email: z.email() });

const RESET_TOKEN_EXPIRES_MINUTES = 30;

/**
 * POST /api/auth/forgot-password
 * Always returns 200 (don't leak whether email exists)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: true }); // silent
    }

    const email = parsed.data.email.toLowerCase();
    const user = await prisma.user.findUnique({ where: { email, isActive: true } });

    if (!user) {
      // Deliberately return success to avoid email enumeration
      return NextResponse.json({ success: true });
    }

    // Generate reset token
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + RESET_TOKEN_EXPIRES_MINUTES);

    await prisma.user.update({
      where: { id: user.id },
      data: { resetToken: token, resetTokenExpiresAt: expiresAt },
    });

    // Build reset URL
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://mom.workinflow.cloud";
    const resetUrl = `${appUrl}/th/reset-password?token=${token}`;

    // Fire and forget email
    sendPasswordResetEmail(user.email, {
      name: user.name,
      resetUrl,
      expiresInMinutes: RESET_TOKEN_EXPIRES_MINUTES,
    }).catch((e) => console.error("reset email error:", e));

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("forgot-password error:", err);
    return NextResponse.json({ success: true }); // still silent
  }
}
