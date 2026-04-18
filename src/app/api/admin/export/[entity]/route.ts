import { NextRequest } from "next/server";
import * as XLSX from "xlsx";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission, ROLES } from "@/lib/permissions";
import { toCsv, csvResponse } from "@/lib/csv";

function xlsxResponse(rows: Record<string, unknown>[], filename: string): Response {
  const ws = XLSX.utils.json_to_sheet(rows);
  const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
  ws["!cols"] = headers.map(() => ({ wch: 20 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Data");
  // XLSX.write returns a Node.js Buffer. Slice its underlying ArrayBuffer
  // so the Web Response constructor accepts it (BodyInit requires ArrayBuffer,
  // not the broader ArrayBufferLike).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nodeBuffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as any;
  const buf: ArrayBuffer = nodeBuffer.buffer.slice(
    nodeBuffer.byteOffset,
    nodeBuffer.byteOffset + nodeBuffer.byteLength,
  ) as ArrayBuffer;
  return new Response(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

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
    const format = req.nextUrl.searchParams.get("format") ?? "csv";

    const today = new Date().toISOString().slice(0, 10);

    function respond(rows: Record<string, unknown>[], baseName: string): Response {
      if (format === "xlsx") {
        return xlsxResponse(rows, `${baseName}-${today}.xlsx`);
      }
      return csvResponse(toCsv(rows), `${baseName}-${today}.csv`);
    }

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
        return respond(rows as Record<string, unknown>[], "customers");
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
        return respond(rows as Record<string, unknown>[], "products");
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
        return respond(rows as Record<string, unknown>[], "materials");
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
        return respond(rows as Record<string, unknown>[], "machines");
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
        return respond(flat as Record<string, unknown>[], "sales-orders");
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
        return respond(flat as Record<string, unknown>[], "invoices");
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
        return respond(flat as Record<string, unknown>[], "work-orders");
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
