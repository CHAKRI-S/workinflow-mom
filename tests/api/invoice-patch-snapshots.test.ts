import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  requirePermission: vi.fn(),
  canEditDocument: vi.fn(),
  createAuditLog: vi.fn(),
  prisma: {
    invoice: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    customer: {
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

vi.mock("@/lib/audit", () => ({
  canEditDocument: mocks.canEditDocument,
  canCancelDocument: vi.fn(),
  createAuditLog: mocks.createAuditLog,
}));

import { PATCH } from "@/app/api/finance/invoices/[id]/route";

function patchRequest(body: unknown) {
  return new Request("http://localhost/api/finance/invoices/inv_1", {
    method: "PATCH",
    body: JSON.stringify(body),
  }) as Parameters<typeof PATCH>[0];
}

const existingInvoice = {
  id: "inv_1",
  invoiceNumber: "INV-2026-0001",
  tenantId: "tenant_1",
  customerId: "cust_1",
  status: "DRAFT",
  billingNature: "MANUFACTURING_SERVICE",
  dueDate: new Date("2026-06-30"),
  notes: null,
};

describe("Invoice PATCH snapshot immutability", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ user: { id: "user_1", name: "Tester", tenantId: "tenant_1" } });
    mocks.canEditDocument.mockReturnValue(true);
    mocks.prisma.invoice.findFirst.mockResolvedValue(existingInvoice);
    mocks.prisma.invoice.update.mockImplementation(async ({ data }) => ({
      ...existingInvoice,
      ...data,
      lines: [],
    }));
    mocks.createAuditLog.mockResolvedValue(undefined);
  });

  it("ignores DRAFT patch attempts to spoof billing and line snapshot fields", async () => {
    const response = await PATCH(
      patchRequest({
        notes: "allowed note",
        billingNature: "GOODS",
        lines: [
          {
            id: "line_1",
            drawingSource: "TENANT_OWNED",
            lineBillingNature: "GOODS",
            productCode: "FAKE-CODE",
            drawingRevision: "FAKE-REV",
            customerDrawingUrl: "https://fake.example/drawing.pdf",
            customerBranding: { mark: "Fake Mark" },
          },
        ],
      }),
      { params: Promise.resolve({ id: "inv_1" }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.prisma.customer.findFirst).not.toHaveBeenCalled();
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
    expect(mocks.prisma.invoice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "inv_1" },
        data: { notes: "allowed note" },
      }),
    );
    expect(JSON.stringify(mocks.prisma.invoice.update.mock.calls[0][0].data)).not.toContain("GOODS");
  });
});
