import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission, ROLES } from "@/lib/permissions";
import { toCsv, csvResponse } from "@/lib/csv";

/**
 * GET /api/admin/export/:entity
 *
 * Exports a tenant's data as CSV. Entity: customers | products | materials |
 * machines | sales-orders | invoices | work-orders
 *
 * Requires MANAGEMENT role (admin or manager).
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ entity: string }> }) {
  try {
    const session = await auth();
    requirePermission(session, ROLES.MANAGEMENT);
    const tenantId = session!.user.tenantId;
    const { entity } = await params;

    const today = new Date().toISOString().slice(0, 10);

    switch (entity) {
      case "customers": {
        const rows = await prisma.customer.findMany({
          where: { tenantId },
          orderBy: { code: "asc" },
          select: {
            code: true, name: true, customerType: true,
            contactName: true, phone: true, email: true,
            taxId: true, billingAddress: true, isVatRegistered: true,
            paymentTermDays: true, isActive: true,
            createdAt: true,
          },
        });
        return csvResponse(toCsv(rows), `customers-${today}.csv`);
      }
      case "products": {
        const rows = await prisma.product.findMany({
          where: { tenantId },
          orderBy: { code: "asc" },
          select: {
            code: true, name: true, category: true, defaultColor: true,
            unitPrice: true, cycleTimeMinutes: true, leadTimeDays: true,
            requiresPainting: true, requiresLogoEngraving: true, isActive: true,
          },
        });
        return csvResponse(toCsv(rows), `products-${today}.csv`);
      }
      case "materials": {
        const rows = await prisma.material.findMany({
          where: { tenantId },
          orderBy: { code: "asc" },
          select: {
            code: true, name: true, type: true, specification: true,
            unit: true, dimensions: true, stockQty: true,
            minStockQty: true, unitCost: true, isActive: true,
          },
        });
        return csvResponse(toCsv(rows), `materials-${today}.csv`);
      }
      case "machines": {
        const rows = await prisma.cncMachine.findMany({
          where: { tenantId },
          orderBy: { code: "asc" },
          select: {
            code: true, name: true, type: true, status: true,
            description: true, isActive: true, createdAt: true,
          },
        });
        return csvResponse(toCsv(rows), `machines-${today}.csv`);
      }
      case "sales-orders": {
        const rows = await prisma.salesOrder.findMany({
          where: { tenantId },
          orderBy: { orderDate: "desc" },
          include: { customer: { select: { code: true, name: true } } },
        });
        const flat = rows.map((r) => ({
          orderNumber: r.orderNumber,
          customerCode: r.customer.code,
          customerName: r.customer.name,
          status: r.status,
          orderDate: r.orderDate,
          requestedDate: r.requestedDate,
          subtotal: r.subtotal,
          vatAmount: r.vatAmount,
          totalAmount: r.totalAmount,
          paymentStatus: r.paymentStatus,
        }));
        return csvResponse(toCsv(flat), `sales-orders-${today}.csv`);
      }
      case "invoices": {
        const rows = await prisma.invoice.findMany({
          where: { tenantId },
          orderBy: { issueDate: "desc" },
          include: { customer: { select: { code: true, name: true } } },
        });
        const flat = rows.map((r) => ({
          invoiceNumber: r.invoiceNumber,
          customerCode: r.customer.code,
          customerName: r.customer.name,
          invoiceType: r.invoiceType,
          status: r.status,
          issueDate: r.issueDate,
          dueDate: r.dueDate,
          subtotal: r.subtotal,
          vatAmount: r.vatAmount,
          totalAmount: r.totalAmount,
          paidAmount: r.paidAmount,
        }));
        return csvResponse(toCsv(flat), `invoices-${today}.csv`);
      }
      case "work-orders": {
        const rows = await prisma.workOrder.findMany({
          where: { tenantId },
          orderBy: { plannedStart: "desc" },
          include: {
            product: { select: { code: true, name: true } },
            cncMachine: { select: { code: true } },
          },
        });
        const flat = rows.map((r) => ({
          woNumber: r.woNumber,
          productCode: r.product.code,
          productName: r.product.name,
          machineCode: r.cncMachine?.code ?? "",
          status: r.status,
          priority: r.priority,
          plannedQty: r.plannedQty,
          completedQty: r.completedQty,
          scrapQty: r.scrapQty,
          plannedStart: r.plannedStart,
          plannedEnd: r.plannedEnd,
        }));
        return csvResponse(toCsv(flat), `work-orders-${today}.csv`);
      }
      default:
        return Response.json({ error: "Unknown entity" }, { status: 400 });
    }
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return Response.json({ error: "Unauthorized" }, { status: 403 });
    }
    console.error("export error:", err);
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
