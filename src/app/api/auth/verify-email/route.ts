import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { EMAIL_VERIFICATION_TOKEN_PREFIX } from "@/lib/email-verification";

function loginRedirect(req: NextRequest, status: string) {
  const url = new URL("/th/login", req.nextUrl.origin);
  url.searchParams.set("verified", status);
  return NextResponse.redirect(url);
}

export async function GET(req: NextRequest) {
  const rawToken = req.nextUrl.searchParams.get("token");
  if (!rawToken) return loginRedirect(req, "invalid");

  const storedToken = `${EMAIL_VERIFICATION_TOKEN_PREFIX}${rawToken}`;
  const user = await prisma.user.findUnique({
    where: { resetToken: storedToken },
    select: {
      id: true,
      isActive: true,
      resetTokenExpiresAt: true,
      emailVerifiedAt: true,
    },
  });

  if (!user || !user.isActive) return loginRedirect(req, "invalid");
  if (user.emailVerifiedAt) return loginRedirect(req, "success");
  if (!user.resetTokenExpiresAt || user.resetTokenExpiresAt < new Date()) {
    return loginRedirect(req, "expired");
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerifiedAt: new Date(),
      resetToken: null,
      resetTokenExpiresAt: null,
    },
  });

  return loginRedirect(req, "success");
}
