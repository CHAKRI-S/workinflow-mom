import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  requirePermission: vi.fn(),
  generateDocNumber: vi.fn(),
  createAuditLog: vi.fn(),
  prisma: {
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
  ROLES: { FINANCE: "FINANCE" },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mocks.prisma,
}));

vi.mock("@/lib/doc-numbering", () => ({
  generateDocNumber: mocks.generateDocNumber,
  invoicePrefixFromTaxType: vi.fn(() => "INV"),
}));

vi.mock("@/lib/audit", () => ({
  createAuditLog: mocks.createAuditLog,
}));

import { POST } from "@/app/api/finance/invoices/route";

function postRequest(body: unknown) {
  return new Request("http://localhost/api/finance/invoices", {
    method: "POST",
    body: JSON.stringify(body),
  }) as Parameters<typeof POST>[0];
}

const customer = {
  id: "cust_1",
  name: "ACME Manufacturing",
  taxId: "0100000000000",
  billingAddress: "Billing address",
  shippingAddress: "Shipping address",
  juristicType: "COMPANY",
  individualTitle: null,
  individualTitleOther: null,
  defaultBillingNature: "GOODS",
  withholdsTax: true,
};

const authoritativeSalesOrderLine = {
  id: "sol_1",
  drawingSource: "CUSTOMER_PROVIDED",
  lineBillingNature: "MANUFACTURING_SERVICE",
  productCode: "SO-SNAPSHOT-CODE",
  drawingRevision: "SO-REV-2",
  customerDrawingUrl: "https://so.example/approved-drawing.pdf",
  customerBranding: { mark: "Approved SO Mark" },
  enteredUnitPrice: 500,
  vatPriceMode: "EXCLUSIVE",
  product: {
    id: "prod_service",
    code: "PROD-LIVE-CODE",
    productKind: "SERVICE",
    drawingSource: "TENANT_OWNED",
    drawingRevision: "LIVE-REV",
    customerDrawingUrl: "https://product.example/live.pdf",
    fusionFileUrl: "https://product.example/fusion.step",
  },
};

const baseSalesOrder = {
  id: "so_1",
  tenantId: "tenant_1",
  customerId: "cust_1",
  billingNature: "MANUFACTURING_SERVICE",
  taxType: "VAT_EXCLUSIVE",
  currencyCode: "THB",
  vatModePolicy: "PER_LINE",
  subtotal: 1000,
  discountAmount: 0,
  vatRate: 7,
  vatAmount: 70,
  totalAmount: 1070,
  customer,
  lines: [authoritativeSalesOrderLine],
};

const hostileInvoiceBody = {
  salesOrderId: "so_1",
  invoiceType: "FULL",
  dueDate: "2026-06-30",
  taxType: "VAT_EXCLUSIVE",
  currencyCode: "THB",
  billingNature: "GOODS",
  lines: [
    {
      salesOrderLineId: "sol_1",
      description: "Service line",
      quantity: 2,
      enteredUnitPrice: 500,
      unitPrice: 500,
      vatPriceMode: "EXCLUSIVE",
      sortOrder: 0,
      drawingSource: "TENANT_OWNED",
      lineBillingNature: "GOODS",
      productCode: "FAKE-CLIENT-CODE",
      drawingRevision: "FAKE-CLIENT-REV",
      customerDrawingUrl: "https://fake.example/client.pdf",
      customerBranding: { mark: "Fake Client Mark" },
    },
  ],
};

describe("Invoice SO/Product snapshot inheritance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ user: { id: "user_1", name: "Tester", tenantId: "tenant_1" } });
    mocks.generateDocNumber.mockResolvedValue("INV-2026-0001");
    mocks.createAuditLog.mockResolvedValue(undefined);
    mocks.prisma.salesOrder.findFirst.mockResolvedValue(baseSalesOrder);
  });

  it("creates invoices from Sales Order snapshots and ignores client-sent drawing/tax fields", async () => {
    const create = vi.fn(async ({ data }) => ({ id: "inv_1", invoiceNumber: "INV-2026-0001", ...data }));
    mocks.prisma.$transaction.mockImplementation(async (callback) =>
      callback({ invoice: { create } }),
    );

    const response = await POST(postRequest(hostileInvoiceBody));

    expect(response.status).toBe(201);
    expect(mocks.prisma.salesOrder.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "so_1", tenantId: "tenant_1" },
      }),
    );
    const createdData = create.mock.calls[0][0].data;
    expect(createdData.billingNature).toBe("MANUFACTURING_SERVICE");
    expect(createdData.lines.create[0]).toMatchObject({
      salesOrderLineId: "sol_1",
      drawingSource: "CUSTOMER_PROVIDED",
      lineBillingNature: "MANUFACTURING_SERVICE",
      productCode: "SO-SNAPSHOT-CODE",
      drawingRevision: "SO-REV-2",
      customerDrawingUrl: "https://so.example/approved-drawing.pdf",
      customerBranding: { mark: "Approved SO Mark" },
      vatPriceMode: "EXCLUSIVE",
    });
  });

  it("uses the Sales Order header billing snapshot and ignores client VAT mode overrides", async () => {
    mocks.prisma.salesOrder.findFirst.mockResolvedValue({
      ...baseSalesOrder,
      billingNature: "MIXED",
    });
    const create = vi.fn(async ({ data }) => ({ id: "inv_1", invoiceNumber: "INV-2026-0001", ...data }));
    mocks.prisma.$transaction.mockImplementation(async (callback) =>
      callback({ invoice: { create } }),
    );

    const response = await POST(
      postRequest({
        ...hostileInvoiceBody,
        lines: [
          {
            ...hostileInvoiceBody.lines[0],
            vatPriceMode: "INCLUSIVE",
          },
        ],
      }),
    );

    expect(response.status).toBe(201);
    const createdData = create.mock.calls[0][0].data;
    expect(createdData.billingNature).toBe("MIXED");
    expect(createdData.lines.create[0].vatPriceMode).toBe("EXCLUSIVE");
  });

  it("rejects invoice lines that do not belong to the selected Sales Order", async () => {
    const response = await POST(
      postRequest({
        ...hostileInvoiceBody,
        lines: [
          {
            ...hostileInvoiceBody.lines[0],
            salesOrderLineId: "foreign_line",
          },
        ],
      }),
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain("Sales order line not found");
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
  });

  it("falls back to Product master through the Sales Order line relation when SO line snapshots are missing", async () => {
    mocks.prisma.salesOrder.findFirst.mockResolvedValue({
      ...baseSalesOrder,
      billingNature: null,
      lines: [
        {
          ...authoritativeSalesOrderLine,
          drawingSource: null,
          lineBillingNature: null,
          productCode: null,
          drawingRevision: null,
          customerDrawingUrl: null,
          customerBranding: null,
          product: {
            id: "prod_service",
            code: "SRV-200",
            productKind: "SERVICE",
            drawingSource: "CUSTOMER_PROVIDED",
            drawingRevision: "PROD-REV-5",
            customerDrawingUrl: null,
            fusionFileUrl: "https://product.example/fallback.step",
          },
        },
      ],
    });
    const create = vi.fn(async ({ data }) => ({ id: "inv_1", invoiceNumber: "INV-2026-0001", ...data }));
    mocks.prisma.$transaction.mockImplementation(async (callback) =>
      callback({ invoice: { create } }),
    );

    const response = await POST(postRequest(hostileInvoiceBody));

    expect(response.status).toBe(201);
    const createdData = create.mock.calls[0][0].data;
    expect(createdData.billingNature).toBe("MANUFACTURING_SERVICE");
    expect(createdData.lines.create[0]).toMatchObject({
      drawingSource: "CUSTOMER_PROVIDED",
      lineBillingNature: "MANUFACTURING_SERVICE",
      productCode: "SRV-200",
      drawingRevision: "PROD-REV-5",
      customerDrawingUrl: "https://product.example/fallback.step",
    });
  });
});
