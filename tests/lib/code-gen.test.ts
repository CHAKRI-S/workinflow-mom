import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  prisma: {
    tenant: {
      findUnique: vi.fn(),
    },
    customer: {
      findMany: vi.fn(),
    },
    product: {
      findMany: vi.fn(),
    },
    material: {
      findMany: vi.fn(),
    },
    consumable: {
      findMany: vi.fn(),
    },
    cncMachine: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mocks.prisma,
}));

import {
  generateConsumableCode,
  generateCustomerCode,
  generateMachineCode,
  generateMasterCode,
  generateMaterialCode,
  generateProductCode,
  getTenantCodePrefix,
  nextCodeFromExisting,
} from "@/lib/code-gen";

describe("master code generation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.prisma.tenant.findUnique.mockResolvedValue({ code: "WF01" });
    mocks.prisma.customer.findMany.mockResolvedValue([]);
    mocks.prisma.product.findMany.mockResolvedValue([]);
    mocks.prisma.material.findMany.mockResolvedValue([]);
    mocks.prisma.consumable.findMany.mockResolvedValue([]);
    mocks.prisma.cncMachine.findMany.mockResolvedValue([]);
  });

  it("formats master codes as TENANT-ENTITY-SEQ:4", () => {
    expect(
      nextCodeFromExisting(["WF01-PRD-0001", "WF01-PRD-0007", "OLD-PRD-0099"], {
        prefix: "WF01-PRD-",
      }),
    ).toBe("WF01-PRD-0008");
  });

  it("uses Tenant.code as the master code prefix", async () => {
    mocks.prisma.product.findMany.mockResolvedValue([
      { code: "WF01-PRD-0001" },
      { code: "WF01-PRD-0012" },
    ]);

    await expect(getTenantCodePrefix("tenant_1")).resolves.toBe("WF01-");
    await expect(generateMasterCode("tenant_1", "product")).resolves.toBe(
      "WF01-PRD-0013",
    );

    expect(mocks.prisma.product.findMany).toHaveBeenCalledWith({
      where: { tenantId: "tenant_1", code: { startsWith: "WF01-PRD-" } },
      select: { code: true },
    });
  });

  it("falls back to ENTITY-SEQ:4 when the tenant has no code", async () => {
    mocks.prisma.tenant.findUnique.mockResolvedValue({ code: "   " });
    mocks.prisma.material.findMany.mockResolvedValue([{ code: "MAT-0003" }]);

    await expect(getTenantCodePrefix("tenant_legacy")).resolves.toBe("");
    await expect(generateMaterialCode("tenant_legacy")).resolves.toBe("MAT-0004");

    expect(mocks.prisma.material.findMany).toHaveBeenCalledWith({
      where: { tenantId: "tenant_legacy", code: { startsWith: "MAT-" } },
      select: { code: true },
    });
  });

  it.each([
    ["customer", generateCustomerCode, "customer", "CUS-", "WF01-CUS-0001"],
    ["product", generateProductCode, "product", "PRD-", "WF01-PRD-0001"],
    ["material", generateMaterialCode, "material", "MAT-", "WF01-MAT-0001"],
    ["consumable", generateConsumableCode, "consumable", "CON-", "WF01-CON-0001"],
    ["machine", generateMachineCode, "cncMachine", "MCN-", "WF01-MCN-0001"],
  ] as const)(
    "generates %s codes with the configured tenant code",
    async (_label, generate, modelName, _entityPrefix, expected) => {
      await expect(generate("tenant_1")).resolves.toBe(expected);
      expect(mocks.prisma[modelName].findMany).toHaveBeenCalledWith({
        where: { tenantId: "tenant_1", code: { startsWith: expected.slice(0, -4) } },
        select: { code: true },
      });
    },
  );
});
