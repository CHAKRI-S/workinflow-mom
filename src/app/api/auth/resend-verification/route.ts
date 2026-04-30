import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { sendEmailVerificationEmail } from "@/lib/email";
import {
  buildEmailVerificationUrl,
  EMAIL_VERIFICATION_EXPIRES_HOURS,
  issueEmailVerificationToken,
} from "@/lib/email-verification";

const schema = z.object({ email: z.email() });

export async function POST(req: NextRequest) {
  try {
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ success: true });
    }

    const email = parsed.data.email.toLowerCase();
    const user = await prisma.user.findFirst({
      where: { email, isActive: true },
      select: {
        id: true,
        email: true,
        name: true,
        emailVerifiedAt: true,
        tenant: {
          select: {
            name: true,
            trialEndsAt: true,
          },
        },
      },
    });

    if (!user || user.emailVerifiedAt) {
      return NextResponse.json({ success: true });
    }

    const verification = await issueEmailVerificationToken(user.id);
    const verifyUrl = buildEmailVerificationUrl(verification.rawToken);

    sendEmailVerificationEmail(user.email, {
      adminName: user.name,
      companyName: user.tenant.name,
      trialEndsAt: user.tenant.trialEndsAt ?? new Date(),
      verifyUrl,
      expiresInHours: EMAIL_VERIFICATION_EXPIRES_HOURS,
    }).catch((e) => console.error("verification resend email error:", e));

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("resend-verification error:", err);
    return NextResponse.json({ success: true });
  }
}
