import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import "dotenv/config";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding database...");

  // Create tenant
  const tenant = await prisma.tenant.upsert({
    where: { code: "WF01" },
    update: {},
    create: {
      name: "WorkinFlow Factory",
      code: "WF01",
    },
  });

  console.log(`Created tenant: ${tenant.name}`);

  // Create admin user
  const hashedPassword = await bcrypt.hash("admin123", 10);
  const admin = await prisma.user.upsert({
    where: { email: "admin@workinflow.com" },
    update: {},
    create: {
      email: "admin@workinflow.com",
      name: "Admin",
      hashedPassword,
      role: "ADMIN",
      tenantId: tenant.id,
    },
  });

  console.log(`Created admin user: ${admin.email}`);

  // Create sample users
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
        tenantId: tenant.id,
      },
    });
    console.log(`Created user: ${u.email} (${u.role})`);
  }

  // Create CNC machines
  const machines = [
    { code: "CNC-01", name: "Mazak QT-250", type: "CNC_LATHE" as const },
    { code: "CNC-02", name: "Haas VF-2", type: "CNC_MILLING" as const },
    { code: "CNC-03", name: "Brother TC-22B", type: "CNC_MILLING" as const },
    { code: "CNC-04", name: "Fanuc RoboDrill", type: "CNC_MILLING" as const },
    { code: "CNC-05", name: "Engraving Machine", type: "CNC_ENGRAVING" as const },
  ];

  for (const m of machines) {
    await prisma.cncMachine.upsert({
      where: { tenantId_code: { tenantId: tenant.id, code: m.code } },
      update: {},
      create: {
        code: m.code,
        name: m.name,
        type: m.type,
        tenantId: tenant.id,
      },
    });
    console.log(`Created machine: ${m.code} - ${m.name}`);
  }

  // Create sample materials
  const materials = [
    {
      code: "MAT-001",
      name: "Aluminium 6061-T6 Round Bar",
      type: "Aluminium",
      specification: "6061-T6",
      unit: "BAR" as const,
    },
    {
      code: "MAT-002",
      name: "Stainless Steel SUS304 Block",
      type: "Stainless Steel",
      specification: "SUS304",
      unit: "BLOCK" as const,
    },
    {
      code: "MAT-003",
      name: "Brass C3604 Round Bar",
      type: "Brass",
      specification: "C3604",
      unit: "BAR" as const,
    },
    {
      code: "MAT-004",
      name: "M6 x 20 SUS304 Hex Bolt",
      type: "Fastener",
      specification: "SUS304",
      unit: "PCS" as const,
    },
    {
      code: "MAT-005",
      name: "M6 SUS304 Hex Nut",
      type: "Fastener",
      specification: "SUS304",
      unit: "PCS" as const,
    },
  ];

  for (const mat of materials) {
    await prisma.material.upsert({
      where: { tenantId_code: { tenantId: tenant.id, code: mat.code } },
      update: {},
      create: {
        ...mat,
        tenantId: tenant.id,
      },
    });
    console.log(`Created material: ${mat.code} - ${mat.name}`);
  }

  // Create sample customers (VAT + non-VAT)
  const customers = [
    {
      code: "CUST-001",
      name: "บริษัท ออโต้พาร์ท จำกัด",
      customerType: "OEM" as const,
      contactName: "คุณสมชาย",
      phone: "081-234-5678",
      taxId: "0105555000001",
      billingAddress: "123 ถ.พระราม 9 แขวงบางกะปิ เขตห้วยขวาง กรุงเทพฯ 10310",
      isVatRegistered: true,
      paymentTermDays: 30,
    },
    {
      code: "CUST-002",
      name: "ร้าน ช.ช่างกลึง",
      customerType: "DEALER" as const,
      contactName: "คุณชัยวัฒน์",
      phone: "089-876-5432",
      billingAddress: "456 ซ.รามอินทรา 40 แขวงท่าแร้ง เขตบางเขน กรุงเทพฯ 10230",
      isVatRegistered: false,  // ร้านค้าไม่จด VAT
      paymentTermDays: 15,
    },
    {
      code: "CUST-003",
      name: "บริษัท เจพี แมนูแฟคเจอริ่ง จำกัด",
      customerType: "OEM" as const,
      contactName: "คุณจิราพร",
      phone: "02-123-4567",
      taxId: "0105562000099",
      billingAddress: "789 นิคมอุตสาหกรรมบางปู ต.แพรกษา อ.เมือง จ.สมุทรปราการ 10280",
      isVatRegistered: true,
      paymentTermDays: 45,
    },
  ];

  for (const c of customers) {
    await prisma.customer.upsert({
      where: { tenantId_code: { tenantId: tenant.id, code: c.code } },
      update: {},
      create: {
        ...c,
        tenantId: tenant.id,
      },
    });
    console.log(`Created customer: ${c.code} - ${c.name} (VAT: ${c.isVatRegistered})`);
  }

  // Create sample products
  const products = [
    {
      code: "PRD-00001",
      name: "Bracket Mount A-100",
      category: "Bracket",
      requiresPainting: true,
      requiresLogoEngraving: true,
      defaultColor: "Black Anodize",
      unitPrice: 850.00,
      leadTimeDays: 14,
    },
    {
      code: "PRD-00002",
      name: "CNC Cover Plate B-200",
      category: "Cover",
      requiresPainting: false,
      requiresLogoEngraving: false,
      defaultSurfaceFinish: "Bead Blast",
      unitPrice: 1200.00,
      leadTimeDays: 7,
    },
    {
      code: "PRD-00003",
      name: "Shaft Adapter C-300",
      category: "Adapter",
      requiresPainting: true,
      requiresLogoEngraving: false,
      defaultColor: "Silver Anodize",
      unitPrice: 650.00,
      leadTimeDays: 10,
    },
  ];

  for (const p of products) {
    await prisma.product.upsert({
      where: { tenantId_code: { tenantId: tenant.id, code: p.code } },
      update: {},
      create: {
        ...p,
        tenantId: tenant.id,
      },
    });
    console.log(`Created product: ${p.code} - ${p.name}`);
  }

  console.log("\nSeed completed!");
  console.log("\nLogin credentials:");
  console.log("  Email: admin@workinflow.com");
  console.log("  Password: admin123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
