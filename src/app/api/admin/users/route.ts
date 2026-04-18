import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission, ROLES } from "@/lib/permissions";
import { requireSeatAvailable, planLimitResponse } from "@/lib/plan-limits";
import bcrypt from "bcryptjs";
import { Role } from "@/generated/prisma/client";

// GET /api/admin/users — list all users for tenant
export async function GET() {
  try {
    const session = await auth();
    requirePermission(session, ROLES.ADMIN_ONLY);

    const users = await prisma.user.findMany({
      where: { tenantId: session!.user.tenantId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(users);
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    console.error("GET /api/admin/users error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/admin/users — create new user
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    requirePermission(session, ROLES.ADMIN_ONLY);

    const body = await req.json();
    const { name, email, password, role, isActive } = body;

    // Validate required fields
    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "Name, email, and password are required" },
        { status: 400 }
      );
    }

    // Validate role
    const validRoles = Object.values(Role);
    if (role && !validRoles.includes(role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    // Check email uniqueness
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: "Email already exists" },
        { status: 409 }
      );
    }

    // Plan seat limit check
    await requireSeatAvailable(session!.user.tenantId);

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        hashedPassword,
        role: role || "OPERATOR",
        isActive: isActive ?? true,
        tenantId: session!.user.tenantId,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    return NextResponse.json(user, { status: 201 });
  } catch (err) {
    const limitRes = planLimitResponse(err);
    if (limitRes) return limitRes;
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    console.error("POST /api/admin/users error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
