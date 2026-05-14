import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  requirePermission: vi.fn(),
  prisma: {
    salesOrder: {
      findFirst: vi.fn(),
    },
    customer: {
      findFirst: vi.fn(),
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

import { PATCH } from "@/app/api/sales/orders/[id]/route";

const existingSalesOrder = {
  id: "so_1",
  tenantId: "tenant_1",
  customerId: "customer_vat",
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
  vatRate: 0,
  vatAmount: 0,
  totalAmount: 1000,
  vatModePolicy: "FORCE_EXCLUSIVE",
  taxType: "NO_VAT",
  currencyCode: "USD",
  paymentTerms: null,
  billingNature: "GOODS",
  notes: null,
  internalNotes: null,
  customer: {
    id: "customer_vat",
    tenantId: "tenant_1",
    isVatRegistered: true,
  },
  lines: [
    {
      productId: "prod_1",
      description: null,
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
      drawingSource: "TENANT_OWNED",
      lineBillingNature: null,
      productCode: null,
      drawingRevision: null,
      customerDrawingUrl: null,
      customerBranding: null,
    },
  ],
};

function patchRequest(body: unknown) {
  return new Request("http://localhost/api/sales/orders/so_1", {
    method: "PATCH",
    body: JSON.stringify(body),
  }) as Parameters<typeof PATCH>[0];
}

describe("SalesOrder PATCH document tax source", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({
      user: { id: "user_1", tenantId: "tenant_1" },
    });
    mocks.prisma.salesOrder.findFirst.mockResolvedValue(existingSalesOrder);
    mocks.prisma.customer.findFirst.mockResolvedValue({
      id: "customer_non_vat",
      tenantId: "tenant_1",
      isVatRegistered: false,
    });
    mocks.prisma.product.findMany.mockResolvedValue([
      {
        id: "prod_1",
        code: "PROD-1",
        productKind: "GOODS",
        drawingSource: "TENANT_OWNED",
        drawingRevision: null,
        customerDrawingUrl: null,
        fusionFileUrl: null,
      },
    ]);
  });

  it("recalculates changed lines from the preserved document taxType, not customer VAT registration", async () => {
    const update = vi.fn(async ({ data }) => ({ id: "so_1", ...data, lines: [] }));
    mocks.prisma.$transaction.mockImplementation(async (callback) =>
      callback({
        salesOrderLine: {
          deleteMany: vi.fn(),
          createMany: vi.fn(),
        },
        salesOrder: { update },
      }),
    );

    await PATCH(
      patchRequest({
        lines: [
          {
            productId: "prod_1",
            quantity: 1,
            unitPrice: 1000,
            discountPercent: 0,
            sortOrder: 0,
          },
        ],
      }),
      { params: Promise.resolve({ id: "so_1" }) },
    );

    const updatedData = update.mock.calls[0][0].data;
    expect(updatedData.taxType).toBe("NO_VAT");
    expect(updatedData.currencyCode).toBe("USD");
    expect(updatedData.vatRate).toBe(0);
    expect(updatedData.vatAmount).toBe(0);
    expect(updatedData.totalAmount).toBe(1000);
  });

  it("changing customer only does not overwrite VAT fields from customer registration", async () => {
    const update = vi.fn(async ({ data }) => ({ id: "so_1", ...data, lines: [] }));
    mocks.prisma.$transaction.mockImplementation(async (callback) =>
      callback({
        salesOrder: { update },
      }),
    );

    await PATCH(
      patchRequest({ customerId: "customer_non_vat" }),
      { params: Promise.resolve({ id: "so_1" }) },
    );

    const updatedData = update.mock.calls[0][0].data;
    expect(updatedData.vatRate).toBeUndefined();
    expect(updatedData.taxType).toBe("NO_VAT");
    expect(updatedData.currencyCode).toBe("USD");
  });
});
