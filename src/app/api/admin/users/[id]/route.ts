import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission, ROLES } from "@/lib/permissions";
import { requireSeatAvailable, planLimitResponse } from "@/lib/plan-limits";
import bcrypt from "bcryptjs";
import { Role, Prisma } from "@/generated/prisma/client";

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

    // Check email uniqueness if email is being changed (case-insensitive)
    let normalizedEmail: string | undefined;
    if (email !== undefined) {
      normalizedEmail = String(email).trim().toLowerCase();
      const existing = await prisma.user.findFirst({
        where: { email: normalizedEmail, id: { not: id } },
      });
      if (existing) {
        return NextResponse.json(
          { error: "อีเมลนี้ถูกใช้แล้ว" },
          { status: 409 }
        );
      }
    }

    // Build update data
    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (normalizedEmail !== undefined) updateData.email = normalizedEmail;
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
    // Unique constraint violation (race condition fallback — email already exists)
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "อีเมลนี้ถูกใช้แล้ว" },
        { status: 409 },
      );
    }
    console.error("PATCH /api/admin/users/[id] error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// DELETE /api/admin/users/[id]
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    requirePermission(session, ROLES.ADMIN_ONLY);
    const { id } = await params;
    const tenantId = session!.user.tenantId;
    const currentUserId = session!.user.id;

    // Block self-delete
    if (id === currentUserId) {
      return NextResponse.json(
        { error: "ไม่สามารถลบบัญชีของตัวเองได้" },
        { status: 400 },
      );
    }

    const target = await prisma.user.findFirst({
      where: { id, tenantId },
      select: { id: true, role: true },
    });
    if (!target) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Block deleting the last admin in the tenant
    if (target.role === Role.ADMIN) {
      const adminCount = await prisma.user.count({
        where: { tenantId, role: Role.ADMIN, isActive: true },
      });
      if (adminCount <= 1) {
        return NextResponse.json(
          { error: "ไม่สามารถลบ ADMIN คนสุดท้ายในระบบได้" },
          { status: 400 },
        );
      }
    }

    // Refuse hard-delete if the user has created financial documents or
    // work-order logs — those relations are Restrict. Suggest deactivate instead.
    const [quoCount, soCount, invCount, rcpCount, logCount] = await Promise.all([
      prisma.quotation.count({ where: { createdById: id } }),
      prisma.salesOrder.count({ where: { createdById: id } }),
      prisma.invoice.count({ where: { createdById: id } }),
      prisma.receipt.count({ where: { createdById: id } }),
      prisma.workOrderLog.count({ where: { createdById: id } }),
    ]);
    const depCount = quoCount + soCount + invCount + rcpCount + logCount;
    if (depCount > 0) {
      return NextResponse.json(
        {
          error:
            "ผู้ใช้นี้มีเอกสารหรือประวัติการใช้งานอยู่ในระบบ ไม่สามารถลบถาวรได้ — กรุณา 'ปิดใช้งาน' แทน",
        },
        { status: 409 },
      );
    }

    await prisma.user.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    console.error("DELETE /api/admin/users/[id] error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
