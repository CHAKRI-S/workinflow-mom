import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  token: z.string().min(32),
  password: z.string().min(8, "รหัสผ่านต้องมีอย่างน้อย 8 ตัว"),
});

// POST /api/auth/reset-password
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid input" },
        { status: 400 },
      );
    }
    const { token, password } = parsed.data;

    const user = await prisma.user.findUnique({ where: { resetToken: token } });
    if (!user || !user.resetTokenExpiresAt || user.resetTokenExpiresAt < new Date()) {
      return NextResponse.json(
        { error: "ลิงก์หมดอายุหรือไม่ถูกต้อง กรุณาขอรีเซ็ตใหม่" },
        { status: 400 },
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        hashedPassword,
        resetToken: null,
        resetTokenExpiresAt: null,
      },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("reset-password error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
