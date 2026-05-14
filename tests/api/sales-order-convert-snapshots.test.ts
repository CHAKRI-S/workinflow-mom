import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  requirePermission: vi.fn(),
  generateDocNumber: vi.fn(),
  prisma: {
    quotation: {
      findFirst: vi.fn(),
      updateMany: vi.fn(),
    },
    product: {
      findMany: vi.fn(),
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

import { POST } from "@/app/api/sales/orders/[id]/convert/route";

function convertRequest(body: unknown = {}) {
  return new Request("http://localhost/api/sales/orders/quote_1/convert", {
    method: "POST",
    body: JSON.stringify(body),
  }) as Parameters<typeof POST>[0];
}

describe("Quotation to SalesOrder conversion snapshots", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ user: { id: "user_1", tenantId: "tenant_1" } });
    mocks.generateDocNumber.mockResolvedValue("SO-2026-0002");
    mocks.prisma.quotation.findFirst.mockResolvedValue({
      id: "quote_1",
      tenantId: "tenant_1",
      customerId: "cust_1",
      status: "APPROVED",
      customer: { shippingAddress: "Ship here" },
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
      billingNature: "MANUFACTURING_SERVICE",
      notes: "approved quote note",
      lines: [
        {
          productId: "prod_changed_after_quote",
          description: "Approved service line",
          quantity: 1,
          color: null,
          surfaceFinish: null,
          materialSpec: null,
          enteredUnitPrice: 1000,
          unitPrice: 1000,
          vatPriceMode: "EXCLUSIVE",
          discountPercent: 0,
          lineTotal: 1000,
          notes: null,
          sortOrder: 0,
          drawingSource: "CUSTOMER_PROVIDED",
          lineBillingNature: "MANUFACTURING_SERVICE",
          productCode: "Q-SNAPSHOT-CODE",
          drawingRevision: "Q-REV-7",
          customerDrawingUrl: "https://quote.example/approved-drawing.pdf",
          customerBranding: { mark: "Approved Mark" },
        },
      ],
    });
  });

  it("preserves approved quotation snapshots without recalculating from current Product master", async () => {
    const create = vi.fn(async ({ data }) => ({ id: "so_2", ...data }));
    const updateMany = vi.fn();
    mocks.prisma.$transaction.mockImplementation(async (callback) =>
      callback({
        salesOrder: { create },
        quotation: { updateMany },
      }),
    );

    const response = await POST(convertRequest(), {
      params: Promise.resolve({ id: "quote_1" }),
    });

    expect(response.status).toBe(201);
    expect(mocks.prisma.product.findMany).not.toHaveBeenCalled();
    const createdData = create.mock.calls[0][0].data;
    expect(createdData.billingNature).toBe("MANUFACTURING_SERVICE");
    expect(createdData.lines.create[0]).toMatchObject({
      drawingSource: "CUSTOMER_PROVIDED",
      lineBillingNature: "MANUFACTURING_SERVICE",
      productCode: "Q-SNAPSHOT-CODE",
      drawingRevision: "Q-REV-7",
      customerDrawingUrl: "https://quote.example/approved-drawing.pdf",
      customerBranding: { mark: "Approved Mark" },
    });
  });
});
