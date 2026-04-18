import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSaSession } from "@/lib/sa-auth";
import { z } from "zod";

const planSchema = z.object({
  tier: z.enum(["FREE", "STARTER", "PRO", "ENTERPRISE", "CUSTOM"]),
  slug: z.string().min(1).max(50),
  name: z.string().min(1).max(100),
  description: z.string().optional().nullable(),
  priceMonthly: z.number().int().min(0),
  priceYearly: z.number().int().min(0),
  yearlyDiscountPercent: z.number().int().min(0).max(100).default(0),
  maxUsers: z.number().int().min(0),
  maxMachines: z.number().int().min(0),
  maxCustomers: z.number().int().min(0),
  maxProducts: z.number().int().min(0),
  maxWorkOrdersPerMonth: z.number().int().min(0).default(0),
  featureProduction: z.boolean().default(true),
  featureFinance: z.boolean().default(true),
  featureMaintenance: z.boolean().default(false),
  featureFactoryDashboard: z.boolean().default(false),
  featureAuditLog: z.boolean().default(false),
  featurePurchaseOrders: z.boolean().default(true),
  featureAdvancedReports: z.boolean().default(false),
  featureExcelExport: z.boolean().default(false),
  featureCustomBranding: z.boolean().default(false),
  featureApiAccess: z.boolean().default(false),
  featureMultiLocation: z.boolean().default(false),
  sortOrder: z.number().int().default(0),
  isPublic: z.boolean().default(true),
  isActive: z.boolean().default(true),
});

export async function GET() {
  try {
    await requireSaSession();
    const plans = await prisma.plan.findMany({
      orderBy: { sortOrder: "asc" },
      include: { _count: { select: { tenants: true } } },
    });
    return NextResponse.json({ plans });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireSaSession();
    const body = await req.json();
    const parsed = planSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
    }
    const plan = await prisma.plan.create({ data: parsed.data });
    return NextResponse.json(plan, { status: 201 });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (err instanceof Error && err.message.includes("Unique")) {
      return NextResponse.json({ error: "Slug นี้ถูกใช้แล้ว" }, { status: 409 });
    }
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
