import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission, ROLES } from "@/lib/permissions";
import { requireMachineAvailable, planLimitResponse } from "@/lib/plan-limits";
import {
  createWithGeneratedCode,
  generateMachineCode,
} from "@/lib/code-gen";
import { Prisma } from "@/generated/prisma/client";

// GET /api/production/machines
export async function GET() {
  const session = await auth();
  requirePermission(session, ROLES.PRODUCTION);

  const machines = await prisma.cncMachine.findMany({
    where: { tenantId: session!.user.tenantId, isActive: true },
    orderBy: { code: "asc" },
    include: {
      _count: { select: { workOrders: true, maintenanceLogs: true } },
    },
  });

  return NextResponse.json(machines);
}

// POST /api/production/machines
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    requirePermission(session, ROLES.PLANNING);

    const body = await req.json();
    const { code, name, type, description, status } = body;
    const tenantId = session!.user.tenantId;

    if (!name || !type) {
      return NextResponse.json(
        { error: "Name and type are required" },
        { status: 400 },
      );
    }

    // Plan limit check
    await requireMachineAvailable(tenantId);

    const providedCode =
      typeof code === "string" && code.trim() ? code.trim() : undefined;

    const baseData = {
      name,
      type,
      description: description || null,
      status: status || "AVAILABLE",
      tenantId,
    };

    const machine = providedCode
      ? await prisma.cncMachine.create({
          data: { ...baseData, code: providedCode },
        })
      : await createWithGeneratedCode({
          generate: () => generateMachineCode(tenantId),
          create: (generatedCode) =>
            prisma.cncMachine.create({
              data: { ...baseData, code: generatedCode },
            }),
        });

    return NextResponse.json(machine, { status: 201 });
  } catch (err) {
    const limitRes = planLimitResponse(err);
    if (limitRes) return limitRes;
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "รหัสเครื่องจักรนี้ถูกใช้แล้ว" },
        { status: 409 },
      );
    }
    console.error("POST /api/production/machines error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
