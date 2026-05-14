import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  requirePermission: vi.fn(),
  requireCustomerAvailable: vi.fn(),
  requireMachineAvailable: vi.fn(),
  prisma: {
    tenant: {
      findUnique: vi.fn(),
    },
    product: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    material: {
      findMany: vi.fn(),
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

function postRequest(url: string, body: unknown) {
  return new Request(url, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

const baseProduct = {
  name: "CNC Bracket",
  requiresPainting: false,
  requiresLogoEngraving: false,
  leadTimeDays: 3,
};

const baseMaterial = {
  name: "Aluminum 6061",
  type: "ALUMINUM",
  unit: "PCS",
};

describe("master create APIs auto-generate codes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ user: { id: "user_1", tenantId: "tenant_1" } });
    mocks.prisma.tenant.findUnique.mockResolvedValue({ code: "WF01" });
    mocks.prisma.product.findMany.mockResolvedValue([]);
    mocks.prisma.material.findMany.mockResolvedValue([]);
    mocks.prisma.product.create.mockImplementation(async ({ data }) => ({ id: "prod_1", ...data }));
    mocks.prisma.material.create.mockImplementation(async ({ data }) => ({ id: "mat_1", ...data }));
  });

  it("creates products without a user-entered code", async () => {
    const { POST } = await import("@/app/api/production/products/route");

    const response = await POST(
      postRequest("http://localhost/api/production/products", baseProduct) as Parameters<
        typeof POST
      >[0],
    );

    expect(response.status).toBe(201);
    expect(mocks.prisma.product.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: "tenant_1",
        code: "WF01-PRD-0001",
        name: "CNC Bracket",
      }),
    });
  });

  it("creates materials without a user-entered code", async () => {
    const { POST } = await import("@/app/api/production/materials/route");

    const response = await POST(
      postRequest("http://localhost/api/production/materials", baseMaterial) as Parameters<
        typeof POST
      >[0],
    );

    expect(response.status).toBe(201);
    expect(mocks.prisma.material.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: "tenant_1",
        code: "WF01-MAT-0001",
        name: "Aluminum 6061",
      }),
    });
  });
});
