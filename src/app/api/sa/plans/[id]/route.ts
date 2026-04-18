import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSaSession } from "@/lib/sa-auth";
import { z } from "zod";

const patchSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional().nullable(),
  priceMonthly: z.number().int().min(0).optional(),
  priceYearly: z.number().int().min(0).optional(),
  yearlyDiscountPercent: z.number().int().min(0).max(100).optional(),
  maxUsers: z.number().int().min(0).optional(),
  maxMachines: z.number().int().min(0).optional(),
  maxCustomers: z.number().int().min(0).optional(),
  maxProducts: z.number().int().min(0).optional(),
  maxWorkOrdersPerMonth: z.number().int().min(0).optional(),
  featureProduction: z.boolean().optional(),
  featureFinance: z.boolean().optional(),
  featureMaintenance: z.boolean().optional(),
  featureFactoryDashboard: z.boolean().optional(),
  featureAuditLog: z.boolean().optional(),
  featurePurchaseOrders: z.boolean().optional(),
  featureAdvancedReports: z.boolean().optional(),
  featureExcelExport: z.boolean().optional(),
  featureCustomBranding: z.boolean().optional(),
  featureApiAccess: z.boolean().optional(),
  featureMultiLocation: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  isPublic: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireSaSession();
    const { id } = await params;
    const body = await req.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
    }
    const plan = await prisma.plan.update({ where: { id }, data: parsed.data });
    return NextResponse.json(plan);
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireSaSession();
    const { id } = await params;
    // Prevent delete if any tenants use this plan
    const inUse = await prisma.tenant.count({ where: { planId: id } });
    if (inUse > 0) {
      return NextResponse.json(
        { error: `ลบไม่ได้ — มี ${inUse} tenant ใช้ plan นี้อยู่` },
        { status: 409 },
      );
    }
    await prisma.plan.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
