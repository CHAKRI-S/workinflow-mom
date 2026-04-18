import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import "dotenv/config";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

/** Plan templates with pricing in satang (1 THB = 100 satang) */
const PLAN_TEMPLATES = [
  {
    tier: "FREE" as const,
    slug: "free",
    name: "Free",
    description: "ทดลองใช้ฟรี เหมาะสำหรับโรงงานขนาดเล็ก",
    priceMonthly: 0,
    priceYearly: 0,
    yearlyDiscountPercent: 0,
    maxUsers: 2,
    maxMachines: 3,
    maxCustomers: 10,
    maxProducts: 20,
    maxWorkOrdersPerMonth: 30,
    featureProduction: true,
    featureFinance: true,
    featureMaintenance: false,
    featureFactoryDashboard: false,
    featureAuditLog: false,
    featurePurchaseOrders: false,
    featureAdvancedReports: false,
    featureExcelExport: false,
    featureCustomBranding: false,
    featureApiAccess: false,
    featureMultiLocation: false,
    sortOrder: 1,
  },
  {
    tier: "STARTER" as const,
    slug: "starter",
    name: "Starter",
    description: "สำหรับโรงงานขนาดเล็กที่ต้องการระบบครบวงจร",
    priceMonthly: 99000,     // ฿990
    priceYearly: 990000,     // ฿9,900 (save ~17%)
    yearlyDiscountPercent: 17,
    maxUsers: 5,
    maxMachines: 10,
    maxCustomers: 50,
    maxProducts: 100,
    maxWorkOrdersPerMonth: 200,
    featureProduction: true,
    featureFinance: true,
    featureMaintenance: true,
    featureFactoryDashboard: true,
    featureAuditLog: false,
    featurePurchaseOrders: true,
    featureAdvancedReports: false,
    featureExcelExport: true,
    featureCustomBranding: false,
    featureApiAccess: false,
    featureMultiLocation: false,
    sortOrder: 2,
  },
  {
    tier: "PRO" as const,
    slug: "pro",
    name: "Professional",
    description: "สำหรับโรงงานขนาดกลางที่ต้องการ feature ขั้นสูง",
    priceMonthly: 299000,    // ฿2,990
    priceYearly: 2990000,    // ฿29,900 (save ~17%)
    yearlyDiscountPercent: 17,
    maxUsers: 20,
    maxMachines: 30,
    maxCustomers: 500,
    maxProducts: 1000,
    maxWorkOrdersPerMonth: 0, // unlimited
    featureProduction: true,
    featureFinance: true,
    featureMaintenance: true,
    featureFactoryDashboard: true,
    featureAuditLog: true,
    featurePurchaseOrders: true,
    featureAdvancedReports: true,
    featureExcelExport: true,
    featureCustomBranding: true,
    featureApiAccess: false,
    featureMultiLocation: false,
    sortOrder: 3,
  },
  {
    tier: "ENTERPRISE" as const,
    slug: "enterprise",
    name: "Enterprise",
    description: "สำหรับองค์กรใหญ่ ไม่จำกัด user และ machines",
    priceMonthly: 799000,    // ฿7,990
    priceYearly: 7990000,    // ฿79,900 (save ~17%)
    yearlyDiscountPercent: 17,
    maxUsers: 0,             // unlimited
    maxMachines: 0,
    maxCustomers: 0,
    maxProducts: 0,
    maxWorkOrdersPerMonth: 0,
    featureProduction: true,
    featureFinance: true,
    featureMaintenance: true,
    featureFactoryDashboard: true,
    featureAuditLog: true,
    featurePurchaseOrders: true,
    featureAdvancedReports: true,
    featureExcelExport: true,
    featureCustomBranding: true,
    featureApiAccess: true,
    featureMultiLocation: true,
    sortOrder: 4,
  },
];

/** Preset users ที่ทุก tenant ใหม่จะได้ (สำหรับ signup) */
export const PRESET_USERS_FOR_NEW_TENANT = [
  { email: "manager@", name: "Factory Manager", role: "MANAGER" as const },
  { email: "planner@", name: "Production Planner", role: "PLANNER" as const },
  { email: "sales@", name: "Sales Team", role: "SALES" as const },
  { email: "operator@", name: "CNC Operator", role: "OPERATOR" as const },
  { email: "qc@", name: "QC Inspector", role: "QC" as const },
  { email: "accounting@", name: "Accounting", role: "ACCOUNTING" as const },
];

async function seedPlans() {
  console.log("\n=== Seeding Plans ===");
  for (const p of PLAN_TEMPLATES) {
    await prisma.plan.upsert({
      where: { slug: p.slug },
      update: {
        name: p.name,
        description: p.description,
        priceMonthly: p.priceMonthly,
        priceYearly: p.priceYearly,
        yearlyDiscountPercent: p.yearlyDiscountPercent,
        maxUsers: p.maxUsers,
        maxMachines: p.maxMachines,
        maxCustomers: p.maxCustomers,
        maxProducts: p.maxProducts,
        maxWorkOrdersPerMonth: p.maxWorkOrdersPerMonth,
        featureProduction: p.featureProduction,
        featureFinance: p.featureFinance,
        featureMaintenance: p.featureMaintenance,
        featureFactoryDashboard: p.featureFactoryDashboard,
        featureAuditLog: p.featureAuditLog,
        featurePurchaseOrders: p.featurePurchaseOrders,
        featureAdvancedReports: p.featureAdvancedReports,
        featureExcelExport: p.featureExcelExport,
        featureCustomBranding: p.featureCustomBranding,
        featureApiAccess: p.featureApiAccess,
        featureMultiLocation: p.featureMultiLocation,
        sortOrder: p.sortOrder,
      },
      create: p,
    });
    console.log(`  ✓ Plan: ${p.name} (${p.slug})`);
  }
}

async function seedSuperAdmin() {
  console.log("\n=== Seeding Super Admin ===");

  const existing = await prisma.superAdmin.findFirst();
  if (existing) {
    console.log(`  • SuperAdmin already exists: ${existing.username} (skipped)`);
    return;
  }

  // Generate random password (16 chars, URL-safe)
  const password = crypto.randomBytes(12).toString("base64url");
  const hashedPassword = await bcrypt.hash(password, 10);

  const sa = await prisma.superAdmin.create({
    data: {
      username: "superadmin",
      email: "superadmin@workinflow.cloud",
      name: "Super Admin",
      hashedPassword,
    },
  });

  console.log("\n  ╔══════════════════════════════════════════════╗");
  console.log("  ║  SUPER ADMIN CREDENTIALS — SAVE THIS!        ║");
  console.log("  ╠══════════════════════════════════════════════╣");
  console.log(`  ║  URL:      https://admin.workinflow.cloud    ║`);
  console.log(`  ║  Username: ${sa.username.padEnd(34)}║`);
  console.log(`  ║  Email:    ${sa.email.padEnd(34)}║`);
  console.log(`  ║  Password: ${password.padEnd(34)}║`);
  console.log("  ╚══════════════════════════════════════════════╝");
  console.log("  ⚠️  Change this password after first login!\n");
}

async function seedDefaultTenant() {
  console.log("\n=== Seeding Default Tenant (WorkinFlow Factory) ===");

  const enterprisePlan = await prisma.plan.findUnique({
    where: { slug: "enterprise" },
  });

  if (!enterprisePlan) {
    throw new Error("Enterprise plan not found. Run plan seeding first.");
  }

  // Create / update the default tenant — link to ENTERPRISE plan, status ACTIVE
  const tenant = await prisma.tenant.upsert({
    where: { code: "WF01" },
    update: {
      slug: "workinflow",
      status: "ACTIVE",
      planId: enterprisePlan.id,
      onboardedAt: new Date(),
    },
    create: {
      name: "WorkinFlow Factory",
      code: "WF01",
      slug: "workinflow",
      status: "ACTIVE",
      planId: enterprisePlan.id,
      onboardedAt: new Date(),
    },
  });

  console.log(`  ✓ Tenant: ${tenant.name} (slug: ${tenant.slug}, plan: ENTERPRISE)`);

  // Backfill slug for any other existing tenants that don't have one
  const tenantsMissingSlug = await prisma.tenant.findMany({
    where: { slug: null },
  });
  for (const t of tenantsMissingSlug) {
    await prisma.tenant.update({
      where: { id: t.id },
      data: {
        slug: t.code.toLowerCase(),
        status: t.status === "TRIAL" ? "ACTIVE" : t.status,
        planId: t.planId ?? enterprisePlan.id,
      },
    });
    console.log(`  ✓ Backfilled tenant: ${t.name} → slug: ${t.code.toLowerCase()}`);
  }

  return tenant;
}

async function seedDefaultUsers(tenantId: string) {
  console.log("\n=== Seeding Default Users ===");

  // Default password for seed accounts (dev / demo only)
  const hashedPassword = await bcrypt.hash("admin123", 10);

  // Admin
  const admin = await prisma.user.upsert({
    where: { email: "admin@workinflow.com" },
    update: {},
    create: {
      email: "admin@workinflow.com",
      name: "Admin",
      hashedPassword,
      role: "ADMIN",
      tenantId,
    },
  });
  console.log(`  ✓ Admin: ${admin.email}`);

  // Other roles
  const users = [
    { email: "sales@workinflow.com", name: "Sales Team", role: "SALES" as const },
    { email: "planner@workinflow.com", name: "Production Planner", role: "PLANNER" as const },
    { email: "operator@workinflow.com", name: "CNC Operator", role: "OPERATOR" as const },
    { email: "qc@workinflow.com", name: "QC Inspector", role: "QC" as const },
    { email: "manager@workinflow.com", name: "Factory Manager", role: "MANAGER" as const },
    { email: "accounting@workinflow.com", name: "Accounting", role: "ACCOUNTING" as const },
  ];

  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: {
        email: u.email,
        name: u.name,
        hashedPassword,
        role: u.role,
        tenantId,
      },
    });
    console.log(`  ✓ User: ${u.email} (${u.role})`);
  }
}

async function seedSampleData(tenantId: string) {
  console.log("\n=== Seeding Sample Data ===");

  // Machines
  const machines = [
    { code: "CNC-01", name: "Mazak QT-250", type: "CNC_LATHE" as const },
    { code: "CNC-02", name: "Haas VF-2", type: "CNC_MILLING" as const },
    { code: "CNC-03", name: "Brother TC-22B", type: "CNC_MILLING" as const },
    { code: "CNC-04", name: "Fanuc RoboDrill", type: "CNC_MILLING" as const },
    { code: "CNC-05", name: "Engraving Machine", type: "CNC_ENGRAVING" as const },
  ];
  for (const m of machines) {
    await prisma.cncMachine.upsert({
      where: { tenantId_code: { tenantId, code: m.code } },
      update: {},
      create: { ...m, tenantId },
    });
  }
  console.log(`  ✓ Machines (${machines.length})`);

  // Materials
  const materials = [
    { code: "MAT-001", name: "Aluminium 6061-T6 Round Bar", type: "Aluminium", specification: "6061-T6", unit: "BAR" as const },
    { code: "MAT-002", name: "Stainless Steel SUS304 Block", type: "Stainless Steel", specification: "SUS304", unit: "BLOCK" as const },
    { code: "MAT-003", name: "Brass C3604 Round Bar", type: "Brass", specification: "C3604", unit: "BAR" as const },
    { code: "MAT-004", name: "M6 x 20 SUS304 Hex Bolt", type: "Fastener", specification: "SUS304", unit: "PCS" as const },
    { code: "MAT-005", name: "M6 SUS304 Hex Nut", type: "Fastener", specification: "SUS304", unit: "PCS" as const },
  ];
  for (const mat of materials) {
    await prisma.material.upsert({
      where: { tenantId_code: { tenantId, code: mat.code } },
      update: {},
      create: { ...mat, tenantId },
    });
  }
  console.log(`  ✓ Materials (${materials.length})`);

  // Customers
  const customers = [
    {
      code: "CUST-001", name: "บริษัท ออโต้พาร์ท จำกัด", customerType: "OEM" as const,
      contactName: "คุณสมชาย", phone: "081-234-5678", taxId: "0105555000001",
      billingAddress: "123 ถ.พระราม 9 แขวงบางกะปิ เขตห้วยขวาง กรุงเทพฯ 10310",
      isVatRegistered: true, paymentTermDays: 30,
    },
    {
      code: "CUST-002", name: "ร้าน ช.ช่างกลึง", customerType: "DEALER" as const,
      contactName: "คุณชัยวัฒน์", phone: "089-876-5432",
      billingAddress: "456 ซ.รามอินทรา 40 แขวงท่าแร้ง เขตบางเขน กรุงเทพฯ 10230",
      isVatRegistered: false, paymentTermDays: 15,
    },
    {
      code: "CUST-003", name: "บริษัท เจพี แมนูแฟคเจอริ่ง จำกัด", customerType: "OEM" as const,
      contactName: "คุณจิราพร", phone: "02-123-4567", taxId: "0105562000099",
      billingAddress: "789 นิคมอุตสาหกรรมบางปู ต.แพรกษา อ.เมือง จ.สมุทรปราการ 10280",
      isVatRegistered: true, paymentTermDays: 45,
    },
  ];
  for (const c of customers) {
    await prisma.customer.upsert({
      where: { tenantId_code: { tenantId, code: c.code } },
      update: {},
      create: { ...c, tenantId },
    });
  }
  console.log(`  ✓ Customers (${customers.length})`);

  // Products
  const products = [
    { code: "PRD-00001", name: "Bracket Mount A-100", category: "Bracket", requiresPainting: true, requiresLogoEngraving: true, defaultColor: "Black Anodize", unitPrice: 850.0, leadTimeDays: 14 },
    { code: "PRD-00002", name: "CNC Cover Plate B-200", category: "Cover", requiresPainting: false, requiresLogoEngraving: false, defaultSurfaceFinish: "Bead Blast", unitPrice: 1200.0, leadTimeDays: 7 },
    { code: "PRD-00003", name: "Shaft Adapter C-300", category: "Adapter", requiresPainting: true, requiresLogoEngraving: false, defaultColor: "Silver Anodize", unitPrice: 650.0, leadTimeDays: 10 },
  ];
  for (const p of products) {
    await prisma.product.upsert({
      where: { tenantId_code: { tenantId, code: p.code } },
      update: {},
      create: { ...p, tenantId },
    });
  }
  console.log(`  ✓ Products (${products.length})`);
}

async function main() {
  console.log("════════════════════════════════════════════════");
  console.log("  WorkinFlow MOM — Database Seed");
  console.log("════════════════════════════════════════════════");

  await seedPlans();
  await seedSuperAdmin();
  const tenant = await seedDefaultTenant();
  await seedDefaultUsers(tenant.id);
  await seedSampleData(tenant.id);

  console.log("\n════════════════════════════════════════════════");
  console.log("  ✓ Seed completed!");
  console.log("════════════════════════════════════════════════");
  console.log("\n  Tenant login (mom.workinflow.cloud):");
  console.log("    Email:    admin@workinflow.com");
  console.log("    Password: admin123");
  console.log("");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
