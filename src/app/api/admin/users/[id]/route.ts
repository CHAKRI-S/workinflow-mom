import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission, ROLES } from "@/lib/permissions";
import { requireSeatAvailable, planLimitResponse } from "@/lib/plan-limits";
import bcrypt from "bcryptjs";
import { Role } from "@/generated/prisma/client";

type Params = { params: Promise<{ id: string }> };

// GET /api/admin/users/[id]
export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth();
  requirePermission(session, ROLES.ADMIN_ONLY);
  const { id } = await params;

  const user = await prisma.user.findFirst({
    where: { id, tenantId: session!.user.tenantId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(user);
}

// PATCH /api/admin/users/[id]
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    requirePermission(session, ROLES.ADMIN_ONLY);
    const { id } = await params;
    const tenantId = session!.user.tenantId;

    const body = await req.json();
    const { name, email, password, role, isActive } = body;

    // Validate role if provided
    if (role) {
      const validRoles = Object.values(Role);
      if (!validRoles.includes(role)) {
        return NextResponse.json({ error: "Invalid role" }, { status: 400 });
      }
    }

    // Load current user first (needed for transition checks + tenant scoping)
    const current = await prisma.user.findFirst({
      where: { id, tenantId },
      select: { id: true, isActive: true },
    });
    if (!current) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Plan seat guard: reactivating a previously-inactive user counts against cap
    if (isActive === true && current.isActive === false) {
      await requireSeatAvailable(tenantId);
    }

    // Check email uniqueness if email is being changed
    if (email) {
      const existing = await prisma.user.findFirst({
        where: { email, id: { not: id } },
      });
      if (existing) {
        return NextResponse.json(
          { error: "Email already exists" },
          { status: 409 }
        );
      }
    }

    // Build update data
    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email;
    if (role !== undefined) updateData.role = role;
    if (isActive !== undefined) updateData.isActive = isActive;

    // Hash password if provided
    if (password) {
      updateData.hashedPassword = await bcrypt.hash(password, 12);
    }

    await prisma.user.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    const limitRes = planLimitResponse(err);
    if (limitRes) return limitRes;
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    console.error("PATCH /api/admin/users/[id] error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
