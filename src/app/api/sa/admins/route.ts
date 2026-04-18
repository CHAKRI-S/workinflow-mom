import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSaSession } from "@/lib/sa-auth";

const createSchema = z.object({
  username: z.string().min(3).max(50),
  email: z.email(),
  name: z.string().min(1).max(100),
  password: z.string().min(8),
});

// GET /api/sa/admins — list all SA users
export async function GET() {
  try {
    await requireSaSession();
    const admins = await prisma.superAdmin.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        username: true,
        email: true,
        name: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });
    return NextResponse.json({ admins });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// POST /api/sa/admins — create new SA user (any existing SA can create)
export async function POST(req: NextRequest) {
  try {
    await requireSaSession();
    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
    }
    const { username, email, name, password } = parsed.data;

    const dup = await prisma.superAdmin.findFirst({
      where: { OR: [{ username: username.toLowerCase() }, { email: email.toLowerCase() }] },
    });
    if (dup) {
      return NextResponse.json({ error: "Username หรือ email นี้มีอยู่แล้ว" }, { status: 409 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const sa = await prisma.superAdmin.create({
      data: {
        username: username.toLowerCase(),
        email: email.toLowerCase(),
        name,
        hashedPassword,
      },
      select: { id: true, username: true, email: true, name: true, createdAt: true },
    });
    return NextResponse.json(sa, { status: 201 });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
