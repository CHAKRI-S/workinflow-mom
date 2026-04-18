import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { SA_COOKIE_NAME, SA_COOKIE_OPTIONS, signSaToken } from "@/lib/sa-auth";

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

// POST /api/sa/auth/login — SA login (separate from tenant auth)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const { username, password } = parsed.data;

    // Allow login with either username or email
    const sa = await prisma.superAdmin.findFirst({
      where: {
        OR: [
          { username: username.toLowerCase() },
          { email: username.toLowerCase() },
        ],
        isActive: true,
      },
    });

    if (!sa) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const valid = await bcrypt.compare(password, sa.hashedPassword);
    if (!valid) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    // Update last login
    await prisma.superAdmin.update({
      where: { id: sa.id },
      data: { lastLoginAt: new Date() },
    });

    const token = await signSaToken({
      sub: sa.id,
      username: sa.username,
      email: sa.email,
      name: sa.name,
    });

    const res = NextResponse.json({
      success: true,
      user: { id: sa.id, username: sa.username, email: sa.email, name: sa.name },
    });
    res.cookies.set(SA_COOKIE_NAME, token, SA_COOKIE_OPTIONS);
    return res;
  } catch (err) {
    console.error("SA login error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
