import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";

export const EMAIL_VERIFICATION_TOKEN_PREFIX = "email-verify:";
export const EMAIL_VERIFICATION_EXPIRES_HOURS = 24;

export function isEmailVerificationToken(token?: string | null): boolean {
  return token?.startsWith(EMAIL_VERIFICATION_TOKEN_PREFIX) ?? false;
}

export function buildEmailVerificationUrl(rawToken: string): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://mom.workinflow.cloud";
  return `${appUrl}/api/auth/verify-email?token=${encodeURIComponent(rawToken)}`;
}

export async function issueEmailVerificationToken(userId: string): Promise<{
  rawToken: string;
  storedToken: string;
  expiresAt: Date;
}> {
  const rawToken = crypto.randomBytes(32).toString("hex");
  const storedToken = `${EMAIL_VERIFICATION_TOKEN_PREFIX}${rawToken}`;
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + EMAIL_VERIFICATION_EXPIRES_HOURS);

  await prisma.user.update({
    where: { id: userId },
    data: {
      resetToken: storedToken,
      resetTokenExpiresAt: expiresAt,
    },
  });

  return { rawToken, storedToken, expiresAt };
}
