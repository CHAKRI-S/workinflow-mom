import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSaSession } from "@/lib/sa-auth";

const patchSchema = z.object({
  name: z.string().optional(),
  email: z.email().optional(),
  isActive: z.boolean().optional(),
  newPassword: z.string().min(8).optional(),
});

// PATCH /api/sa/admins/:id — update name/email/active/password
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSaSession();
    const { id } = await params;
    const body = await req.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
    }
    const data: Record<string, unknown> = {};
    if (parsed.data.name) data.name = parsed.data.name;
    if (parsed.data.email) data.email = parsed.data.email.toLowerCase();
    if (parsed.data.isActive !== undefined) data.isActive = parsed.data.isActive;
    if (parsed.data.newPassword) {
      data.hashedPassword = await bcrypt.hash(parsed.data.newPassword, 10);
    }

    // Self-deactivation guard
    if (parsed.data.isActive === false && id === session.sub) {
      return NextResponse.json({ error: "ไม่สามารถปิดบัญชีตัวเองได้" }, { status: 400 });
    }

    const sa = await prisma.superAdmin.update({
      where: { id },
      data,
      select: { id: true, username: true, email: true, name: true, isActive: true },
    });
    return NextResponse.json(sa);
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// DELETE /api/sa/admins/:id — remove SA (not self)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSaSession();
    const { id } = await params;
    if (id === session.sub) {
      return NextResponse.json({ error: "ไม่สามารถลบบัญชีตัวเองได้" }, { status: 400 });
    }
    // Ensure at least one SA remains
    const count = await prisma.superAdmin.count({ where: { isActive: true } });
    if (count <= 1) {
      return NextResponse.json({ error: "ต้องมี SA อย่างน้อย 1 คน" }, { status: 400 });
    }
    await prisma.superAdmin.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
