import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission, ROLES } from "@/lib/permissions";
import { AccessDenied } from "@/components/shared/access-denied";
import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { ReportsClient } from "./reports-client";

export default async function ReportsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await auth();
  if (!session?.user) redirect(`/${locale}/login`);
  if (!hasPermission(session, ROLES.MANAGEMENT)) return <AccessDenied />;
  const tenantId = session.user.tenantId;

  // Date ranges
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfYear = new Date(now.getFullYear(), 0, 1);

  // Run all queries in parallel
  const [
    salesOrdersThisMonth,
    salesOrdersThisYear,
    workOrderStats,
    overdueInvoices,
    topProducts,
    topCustomers,
    machineUtilization,
  ] = await Promise.all([
    // Sales this month
    prisma.salesOrder.aggregate({
      where: {
        tenantId,
        orderDate: { gte: startOfMonth },
        status: { not: "CANCELLED" },
      },
      _sum: { totalAmount: true },
      _count: true,
    }),
    // Sales this year
    prisma.salesOrder.aggregate({
      where: {
        tenantId,
        orderDate: { gte: startOfYear },
        status: { not: "CANCELLED" },
      },
      _sum: { totalAmount: true },
      _count: true,
    }),
    // Work order stats
    prisma.workOrder.groupBy({
      by: ["status"],
      where: { tenantId },
      _count: true,
    }),
    // Overdue invoices
    prisma.invoice.findMany({
      where: {
        tenantId,
        status: { in: ["ISSUED", "SENT", "PARTIALLY_PAID"] },
        dueDate: { lt: now },
      },
      include: { customer: { select: { name: true } } },
      orderBy: { dueDate: "asc" },
      take: 10,
    }),
    // Top products by order count (this year)
    prisma.salesOrderLine.groupBy({
      by: ["productId"],
      where: {
        salesOrder: {
          tenantId,
          orderDate: { gte: startOfYear },
          status: { not: "CANCELLED" },
        },
      },
      _sum: { lineTotal: true, quantity: true },
      _count: true,
      orderBy: { _sum: { lineTotal: "desc" } },
      take: 5,
    }),
    // Top customers
    prisma.salesOrder.groupBy({
      by: ["customerId"],
      where: {
        tenantId,
        orderDate: { gte: startOfYear },
        status: { not: "CANCELLED" },
      },
      _sum: { totalAmount: true },
      _count: true,
      orderBy: { _sum: { totalAmount: "desc" } },
      take: 5,
    }),
    // Machine utilization (work orders per machine)
    prisma.workOrder.groupBy({
      by: ["cncMachineId"],
      where: { tenantId, cncMachineId: { not: null } },
      _count: true,
    }),
  ]);

  // Fetch related names for top products and customers
  const productIds = topProducts.map((p) => p.productId);
  const customerIds = topCustomers.map((c) => c.customerId);

  const [products, customers, machines] = await Promise.all([
    prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, code: true, name: true },
    }),
    prisma.customer.findMany({
      where: { id: { in: customerIds } },
      select: { id: true, code: true, name: true },
    }),
    prisma.cncMachine.findMany({
      where: { tenantId },
      select: { id: true, code: true, name: true },
    }),
  ]);

  // Build report data
  const woCompleted = workOrderStats
    .filter((w) => w.status === "COMPLETED")
    .reduce((sum, w) => sum + w._count, 0);
  const woTotal = workOrderStats.reduce((sum, w) => sum + w._count, 0);
  const completionRate =
    woTotal > 0 ? Math.round((woCompleted / woTotal) * 100) : 0;

  const reportData = {
    salesThisMonth: {
      total: Number(salesOrdersThisMonth._sum.totalAmount || 0),
      count: salesOrdersThisMonth._count,
    },
    salesThisYear: {
      total: Number(salesOrdersThisYear._sum.totalAmount || 0),
      count: salesOrdersThisYear._count,
    },
    completionRate,
    woByStatus: workOrderStats.map((w) => ({
      status: w.status,
      count: w._count,
    })),
    overdueInvoices: JSON.parse(JSON.stringify(overdueInvoices)),
    topProducts: topProducts.map((p) => {
      const prod = products.find((pr) => pr.id === p.productId);
      return {
        name: prod?.name || "Unknown",
        code: prod?.code || "",
        total: Number(p._sum?.lineTotal || 0),
        count: p._count,
      };
    }),
    topCustomers: topCustomers.map((c) => {
      const cust = customers.find((cu) => cu.id === c.customerId);
      return {
        name: cust?.name || "Unknown",
        code: cust?.code || "",
        total: Number(c._sum?.totalAmount || 0),
        count: c._count,
      };
    }),
    machineUtilization: machineUtilization.map((m) => {
      const machine = machines.find((mc) => mc.id === m.cncMachineId);
      return {
        name: machine?.name || "Unknown",
        code: machine?.code || "",
        count: m._count,
      };
    }),
  };

  return <ReportsClient data={reportData} />;
}
