import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  requirePermission: vi.fn(),
  generateMaterialCode: vi.fn(),
  createWithGeneratedCode: vi.fn(),
  prisma: {
    product: {
      findFirst: vi.fn(),
    },
    material: {
      findMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
  tx: {
    bomLine: {
      deleteMany: vi.fn(),
      create: vi.fn(),
    },
    material: {
      create: vi.fn(),
    },
  },
}));

vi.mock("@/lib/auth", () => ({
  auth: mocks.auth,
}));

vi.mock("@/lib/permissions", () => ({
  requirePermission: mocks.requirePermission,
  ROLES: { ALL: "ALL", PLANNING: "PLANNING", PRODUCTION: "PRODUCTION" },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mocks.prisma,
}));

vi.mock("@/lib/code-gen", () => ({
  generateMaterialCode: mocks.generateMaterialCode,
  createWithGeneratedCode: mocks.createWithGeneratedCode,
}));

function putRequest(body: unknown) {
  return new Request("http://localhost/api/production/products/prod_1/bom", {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

describe("PUT /api/production/products/[id]/bom inline materials", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ user: { id: "user_1", tenantId: "tenant_1" } });
    mocks.prisma.product.findFirst.mockResolvedValue({ id: "prod_1", tenantId: "tenant_1" });
    mocks.prisma.material.findMany.mockResolvedValue([]);
    mocks.generateMaterialCode.mockResolvedValue("WF01-MAT-0007");
    mocks.createWithGeneratedCode.mockImplementation(async ({ generate, create }) =>
      create(await generate()),
    );
    mocks.prisma.$transaction.mockImplementation(async (cb) => cb(mocks.tx));
    mocks.tx.material.create.mockImplementation(async ({ data }) => ({ id: "mat_inline", ...data }));
    mocks.tx.bomLine.create.mockImplementation(async ({ data }) => ({ id: "bom_1", ...data }));
  });

  it("creates an inline material inside the replacement transaction and writes sourcing", async () => {
    const { PUT } = await import("@/app/api/production/products/[id]/bom/route");

    const response = await PUT(putRequest({
      lines: [
        {
          newMaterial: {
            name: "Aluminum 6061 Flat Bar",
            type: "ALUMINUM",
            specification: "6061-T6",
            unit: "BAR",
            dimensions: "25 x 50 x 3000mm",
            minStockQty: 5,
            unitCost: 1200,
          },
          qtyPerUnit: 0.25,
          materialSize: "25 x 50 x 120mm",
          materialType: "AL6061-T6",
          piecesPerStock: 24,
          notes: "ซื้อเฉพาะงานนี้",
          sourcing: "JOB_SPECIFIC",
          sortOrder: 0,
        },
      ],
    }) as Parameters<typeof PUT>[0], { params: Promise.resolve({ id: "prod_1" }) });

    expect(response.status).toBe(200);
    expect(mocks.prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mocks.createWithGeneratedCode).not.toHaveBeenCalled();
    expect(mocks.generateMaterialCode).toHaveBeenCalledWith("tenant_1");
    expect(mocks.tx.material.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: "tenant_1",
        code: "WF01-MAT-0007",
        name: "Aluminum 6061 Flat Bar",
        type: "ALUMINUM",
        specification: "6061-T6",
        unit: "BAR",
        dimensions: "25 x 50 x 3000mm",
        stockQty: 0,
        minStockQty: 5,
        unitCost: 1200,
      }),
    });
    expect(mocks.tx.bomLine.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        productId: "prod_1",
        materialId: "mat_inline",
        qtyPerUnit: 0.25,
        materialSize: "25 x 50 x 120mm",
        materialType: "AL6061-T6",
        piecesPerStock: 24,
        notes: "ซื้อเฉพาะงานนี้",
        sourcing: "JOB_SPECIFIC",
        sortOrder: 0,
      }),
    });
  });

  it("retries the whole BOM replacement transaction after a generated material code collision", async () => {
    const uniqueError = { code: "P2002" };
    mocks.generateMaterialCode
      .mockResolvedValueOnce("WF01-MAT-0007")
      .mockResolvedValueOnce("WF01-MAT-0008");
    mocks.tx.material.create.mockRejectedValueOnce(uniqueError);
    mocks.prisma.$transaction
      .mockImplementationOnce(async (cb) => cb(mocks.tx))
      .mockImplementationOnce(async (cb) => cb(mocks.tx));

    const { PUT } = await import("@/app/api/production/products/[id]/bom/route");

    const response = await PUT(putRequest({
      lines: [
        {
          newMaterial: { name: "Aluminum Bar", unit: "BAR" },
          qtyPerUnit: 1,
          sourcing: "JOB_SPECIFIC",
        },
      ],
    }) as Parameters<typeof PUT>[0], { params: Promise.resolve({ id: "prod_1" }) });

    expect(response.status).toBe(200);
    expect(mocks.prisma.$transaction).toHaveBeenCalledTimes(2);
    expect(mocks.tx.material.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ code: "WF01-MAT-0008" }),
    });
  });

  it("creates unique generated codes for multiple inline materials in the same transaction", async () => {
    const createdCodes: string[] = [];
    mocks.generateMaterialCode.mockResolvedValue("WF01-MAT-0007");
    mocks.tx.material.create.mockImplementation(async ({ data }) => {
      createdCodes.push(data.code);
      return { id: `mat_${createdCodes.length}`, ...data };
    });

    const { PUT } = await import("@/app/api/production/products/[id]/bom/route");

    const response = await PUT(putRequest({
      lines: [
        {
          newMaterial: { name: "Aluminum Bar", unit: "BAR" },
          qtyPerUnit: 1,
          sourcing: "JOB_SPECIFIC",
          sortOrder: 0,
        },
        {
          newMaterial: { name: "Brass Rod", unit: "ROD" },
          qtyPerUnit: 1,
          sourcing: "JOB_SPECIFIC",
          sortOrder: 1,
        },
      ],
    }) as Parameters<typeof PUT>[0], { params: Promise.resolve({ id: "prod_1" }) });

    expect(response.status).toBe(200);
    expect(createdCodes).toEqual(["WF01-MAT-0007", "WF01-MAT-0008"]);
    expect(mocks.tx.bomLine.create).toHaveBeenNthCalledWith(1, {
      data: expect.objectContaining({ materialId: "mat_1", sourcing: "JOB_SPECIFIC" }),
    });
    expect(mocks.tx.bomLine.create).toHaveBeenNthCalledWith(2, {
      data: expect.objectContaining({ materialId: "mat_2", sourcing: "JOB_SPECIFIC" }),
    });
  });

  it("verifies existing materials belong to the tenant and writes sourcing", async () => {
    mocks.prisma.material.findMany.mockResolvedValue([{ id: "mat_1" }]);
    const { PUT } = await import("@/app/api/production/products/[id]/bom/route");

    const response = await PUT(putRequest({
      lines: [
        {
          materialId: "mat_1",
          qtyPerUnit: 2,
          sourcing: "STOCK_CUT",
          sortOrder: 1,
        },
      ],
    }) as Parameters<typeof PUT>[0], { params: Promise.resolve({ id: "prod_1" }) });

    expect(response.status).toBe(200);
    expect(mocks.prisma.material.findMany).toHaveBeenCalledWith({
      where: { id: { in: ["mat_1"] }, tenantId: "tenant_1" },
      select: { id: true },
    });
    expect(mocks.tx.bomLine.deleteMany).toHaveBeenCalledWith({ where: { productId: "prod_1" } });
    expect(mocks.tx.bomLine.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        productId: "prod_1",
        materialId: "mat_1",
        qtyPerUnit: 2,
        sourcing: "STOCK_CUT",
        sortOrder: 1,
      }),
    });
  });

  it("rejects existing material ids outside the tenant before replacing BOM lines", async () => {
    mocks.prisma.material.findMany.mockResolvedValue([]);
    const { PUT } = await import("@/app/api/production/products/[id]/bom/route");

    const response = await PUT(putRequest({
      lines: [
        {
          materialId: "mat_other_tenant",
          qtyPerUnit: 1,
          sourcing: "STOCK_CUT",
          sortOrder: 0,
        },
      ],
    }) as Parameters<typeof PUT>[0], { params: Promise.resolve({ id: "prod_1" }) });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid materialId" });
    expect(mocks.tx.bomLine.deleteMany).not.toHaveBeenCalled();
    expect(mocks.tx.bomLine.create).not.toHaveBeenCalled();
  });
});
