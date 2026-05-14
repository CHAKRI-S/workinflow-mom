import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  requirePermission: vi.fn(),
  generateDocNumber: vi.fn(),
  prisma: {
    customer: {
      findFirst: vi.fn(),
    },
    product: {
      findMany: vi.fn(),
    },
    quotation: {
      findFirst: vi.fn(),
    },
    salesOrder: {
      findFirst: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/auth", () => ({
  auth: mocks.auth,
}));

vi.mock("@/lib/permissions", () => ({
  requirePermission: mocks.requirePermission,
  ROLES: { SALES_TEAM: "SALES_TEAM" },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mocks.prisma,
}));

vi.mock("@/lib/doc-numbering", () => ({
  DOC_PREFIX: { SALES_ORDER: "SO" },
  generateDocNumber: mocks.generateDocNumber,
}));

import { POST } from "@/app/api/sales/orders/route";
import { PATCH } from "@/app/api/sales/orders/[id]/route";

function postRequest(body: unknown) {
  return new Request("http://localhost/api/sales/orders", {
    method: "POST",
    body: JSON.stringify(body),
  }) as Parameters<typeof POST>[0];
}

function patchRequest(body: unknown) {
  return new Request("http://localhost/api/sales/orders/so_1", {
    method: "PATCH",
    body: JSON.stringify(body),
  }) as Parameters<typeof PATCH>[0];
}

const hostileLine = {
  productId: "prod_service",
  quantity: 2,
  unitPrice: 500,
  vatPriceMode: "EXCLUSIVE",
  discountPercent: 0,
  sortOrder: 0,
  drawingSource: "TENANT_OWNED",
  lineBillingNature: "GOODS",
  productCode: "FAKE-CLIENT-CODE",
  drawingRevision: "FAKE-REV",
  customerDrawingUrl: "https://fake.example/drawing.pdf",
};

const authoritativeProduct = {
  id: "prod_service",
  code: "SRV-100",
  productKind: "SERVICE",
  drawingSource: "CUSTOMER_PROVIDED",
  drawingRevision: "CUST-R2",
  customerDrawingUrl: "https://customer.example/drawing.pdf",
  fusionFileUrl: "https://tenant.example/fusion.step",
};

const salesOrderBody = {
  customerId: "cust_1",
  requestedDate: "2026-06-01",
  depositPercent: 10,
  taxType: "VAT_EXCLUSIVE",
  currencyCode: "THB",
  vatModePolicy: "FORCE_EXCLUSIVE",
  billingNature: "GOODS",
  lines: [hostileLine],
};

const existingSalesOrder = {
  id: "so_1",
  tenantId: "tenant_1",
  customerId: "cust_1",
  quotationId: null,
  customerPoNumber: null,
  requestedDate: new Date("2026-06-01"),
  promisedDate: null,
  shippingAddress: null,
  status: "CONFIRMED",
  depositPercent: 10,
  depositAmount: 100,
  subtotal: 1000,
  discountPercent: 0,
  discountAmount: 0,
  vatRate: 7,
  vatAmount: 70,
  totalAmount: 1070,
  vatModePolicy: "FORCE_EXCLUSIVE",
  taxType: "VAT_EXCLUSIVE",
  currencyCode: "THB",
  paymentTerms: null,
  billingNature: "GOODS",
  notes: null,
  internalNotes: null,
  customer: { id: "cust_1", tenantId: "tenant_1" },
  lines: [],
};

describe("SalesOrder Product-master snapshot derivation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ user: { id: "user_1", tenantId: "tenant_1" } });
    mocks.generateDocNumber.mockResolvedValue("SO-2026-0001");
    mocks.prisma.customer.findFirst.mockResolvedValue({ id: "cust_1", tenantId: "tenant_1" });
    mocks.prisma.quotation.findFirst.mockResolvedValue({ id: "quote_1", tenantId: "tenant_1" });
    mocks.prisma.product.findMany.mockResolvedValue([authoritativeProduct]);
  });

  it("creates direct sales orders from Product snapshots and ignores client-sent drawing/tax fields", async () => {
    const create = vi.fn(async ({ data }) => ({ id: "so_1", ...data }));
    mocks.prisma.$transaction.mockImplementation(async (callback) =>
      callback({
        salesOrder: { create },
      }),
    );

    const response = await POST(postRequest(salesOrderBody));

    expect(response.status).toBe(201);
    expect(mocks.prisma.product.findMany).toHaveBeenCalledWith({
      where: {
        id: { in: ["prod_service"] },
        tenantId: "tenant_1",
        isActive: true,
      },
      select: {
        id: true,
        code: true,
        productKind: true,
        drawingSource: true,
        drawingRevision: true,
        customerDrawingUrl: true,
        fusionFileUrl: true,
      },
    });
    const createdData = create.mock.calls[0][0].data;
    expect(createdData.billingNature).toBe("MANUFACTURING_SERVICE");
    expect(createdData.lines.create[0]).toMatchObject({
      drawingSource: "CUSTOMER_PROVIDED",
      lineBillingNature: "MANUFACTURING_SERVICE",
      productCode: "SRV-100",
      drawingRevision: "CUST-R2",
      customerDrawingUrl: "https://customer.example/drawing.pdf",
    });
  });

  it("updates direct sales order lines from Product snapshots and preserves header snapshots when no lines are patched", async () => {
    mocks.prisma.salesOrder.findFirst.mockResolvedValue(existingSalesOrder);
    const createMany = vi.fn();
    const update = vi.fn(async ({ data }) => ({ id: "so_1", ...data, lines: [] }));
    mocks.prisma.$transaction.mockImplementation(async (callback) =>
      callback({
        salesOrderLine: {
          deleteMany: vi.fn(),
          createMany,
        },
        salesOrder: { update },
      }),
    );

    await PATCH(patchRequest({ lines: [hostileLine] }), {
      params: Promise.resolve({ id: "so_1" }),
    });

    expect(update.mock.calls[0][0].data.billingNature).toBe("MANUFACTURING_SERVICE");
    expect(createMany.mock.calls[0][0].data[0]).toMatchObject({
      drawingSource: "CUSTOMER_PROVIDED",
      lineBillingNature: "MANUFACTURING_SERVICE",
      productCode: "SRV-100",
      drawingRevision: "CUST-R2",
      customerDrawingUrl: "https://customer.example/drawing.pdf",
    });

    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ user: { id: "user_1", tenantId: "tenant_1" } });
    mocks.prisma.salesOrder.findFirst.mockResolvedValue(existingSalesOrder);
    const headerUpdate = vi.fn(async ({ data }) => ({ id: "so_1", ...data, lines: [] }));
    mocks.prisma.$transaction.mockImplementation(async (callback) =>
      callback({ salesOrder: { update: headerUpdate } }),
    );

    await PATCH(patchRequest({ notes: "header only" }), {
      params: Promise.resolve({ id: "so_1" }),
    });

    expect(mocks.prisma.product.findMany).not.toHaveBeenCalled();
    expect(headerUpdate.mock.calls[0][0].data.billingNature).toBeUndefined();
  });

  it("rejects direct sales order quotation links that do not belong to the tenant", async () => {
    mocks.prisma.quotation.findFirst.mockResolvedValue(null);

    const response = await POST(
      postRequest({ ...salesOrderBody, quotationId: "foreign_quote" }),
    );

    expect(response.status).toBe(404);
    expect(mocks.prisma.product.findMany).not.toHaveBeenCalled();
  });

  it("preserves approved quotation snapshots when converted sales order lines are later patched", async () => {
    mocks.prisma.salesOrder.findFirst.mockResolvedValue({
      ...existingSalesOrder,
      quotationId: "quote_1",
      billingNature: "MANUFACTURING_SERVICE",
      lines: [
        {
          productId: "prod_service",
          description: "Approved quote service",
          quantity: 1,
          color: null,
          surfaceFinish: null,
          materialSpec: null,
          enteredUnitPrice: 1000,
          unitPrice: 1000,
          vatPriceMode: "EXCLUSIVE",
          discountPercent: 0,
          notes: null,
          sortOrder: 0,
          drawingSource: "CUSTOMER_PROVIDED",
          lineBillingNature: "MANUFACTURING_SERVICE",
          productCode: "QUOTE-SNAPSHOT",
          drawingRevision: "QUOTE-REV-9",
          customerDrawingUrl: "https://quote.example/approved.pdf",
          customerBranding: { mark: "Approved Mark" },
        },
      ],
    });
    const createMany = vi.fn();
    const update = vi.fn(async ({ data }) => ({ id: "so_1", ...data, lines: [] }));
    mocks.prisma.$transaction.mockImplementation(async (callback) =>
      callback({
        salesOrderLine: {
          deleteMany: vi.fn(),
          createMany,
        },
        salesOrder: { update },
      }),
    );

    await PATCH(patchRequest({ lines: [{ ...hostileLine, quantity: 3 }] }), {
      params: Promise.resolve({ id: "so_1" }),
    });

    expect(mocks.prisma.product.findMany).not.toHaveBeenCalled();
    expect(update.mock.calls[0][0].data.billingNature).toBe("MANUFACTURING_SERVICE");
    expect(createMany.mock.calls[0][0].data[0]).toMatchObject({
      quantity: 3,
      drawingSource: "CUSTOMER_PROVIDED",
      lineBillingNature: "MANUFACTURING_SERVICE",
      productCode: "QUOTE-SNAPSHOT",
      drawingRevision: "QUOTE-REV-9",
      customerDrawingUrl: "https://quote.example/approved.pdf",
      customerBranding: { mark: "Approved Mark" },
    });
  });
});
