/**
 * Sequential code generator for master data (customers, products, machines, ...).
 *
 * Unlike `doc-numbering.ts` (which uses a dedicated DocumentSequence table keyed
 * by year), master data codes don't reset yearly and are created infrequently
 * enough that we can scan existing rows + retry on unique-constraint collision.
 *
 * Format: `{TENANT_CODE}-{ENTITY_PREFIX}-{SEQ:4}` (e.g. "WF01-PRD-0001").
 * If a legacy tenant has no configured code, the fallback is
 * `{ENTITY_PREFIX}-{SEQ:4}` (e.g. "PRD-0001").
 *
 * Race safety: the caller wraps `create` in a retry loop via
 * `createWithGeneratedCode` — if two concurrent inserts get the same next code,
 * Prisma throws P2002 and we try again with the incremented number.
 */

import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";

export interface CodeGenOptions {
  prefix: string;
  /** Width of the numeric suffix (zero-padded). Default 4 → 0001..9999. */
  padding?: number;
}

export type MasterCodeKind =
  | "customer"
  | "product"
  | "material"
  | "consumable"
  | "machine";

const MASTER_PREFIX: Record<MasterCodeKind, string> = {
  customer: "CUS",
  product: "PRD",
  material: "MAT",
  consumable: "CON",
  machine: "MCN",
};

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Find the highest existing numeric suffix matching `<prefix>\d+` in the given
 * list of codes and return `<prefix><max+1>` zero-padded.
 */
export function nextCodeFromExisting(
  existingCodes: string[],
  opts: CodeGenOptions,
): string {
  const padding = opts.padding ?? 4;
  const re = new RegExp("^" + escapeRegex(opts.prefix) + "(\\d+)$");
  let max = 0;
  for (const c of existingCodes) {
    const m = re.exec(c);
    if (m) {
      const n = Number.parseInt(m[1], 10);
      if (Number.isFinite(n) && n > max) max = n;
    }
  }
  return opts.prefix + String(max + 1).padStart(padding, "0");
}

export async function getTenantCodePrefix(tenantId: string): Promise<string> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { code: true },
  });
  const tenantCode = tenant?.code?.trim();
  return tenantCode ? `${tenantCode}-` : "";
}

async function findExistingMasterCodes(
  tenantId: string,
  kind: MasterCodeKind,
  prefix: string,
): Promise<string[]> {
  const query = {
    where: { tenantId, code: { startsWith: prefix } },
    select: { code: true },
  };

  switch (kind) {
    case "customer":
      return (await prisma.customer.findMany(query)).map((row) => row.code);
    case "product":
      return (await prisma.product.findMany(query)).map((row) => row.code);
    case "material":
      return (await prisma.material.findMany(query)).map((row) => row.code);
    case "consumable":
      return (await prisma.consumable.findMany(query)).map((row) => row.code);
    case "machine":
      return (await prisma.cncMachine.findMany(query)).map((row) => row.code);
  }
}

export async function generateMasterCode(
  tenantId: string,
  kind: MasterCodeKind,
): Promise<string> {
  const prefix = `${await getTenantCodePrefix(tenantId)}${MASTER_PREFIX[kind]}-`;
  const existingCodes = await findExistingMasterCodes(tenantId, kind, prefix);
  return nextCodeFromExisting(existingCodes, { prefix });
}

export async function generateCustomerCode(tenantId: string): Promise<string> {
  return generateMasterCode(tenantId, "customer");
}

export async function generateProductCode(tenantId: string): Promise<string> {
  return generateMasterCode(tenantId, "product");
}

export async function generateMaterialCode(tenantId: string): Promise<string> {
  return generateMasterCode(tenantId, "material");
}

export async function generateConsumableCode(tenantId: string): Promise<string> {
  return generateMasterCode(tenantId, "consumable");
}

export async function generateMachineCode(tenantId: string): Promise<string> {
  return generateMasterCode(tenantId, "machine");
}

/**
 * Run `create(code)` with an auto-generated code. On a P2002 unique-constraint
 * violation (race — another insert got the same code first), regenerate and
 * retry up to `maxAttempts` times.
 */
export async function createWithGeneratedCode<T>(opts: {
  generate: () => Promise<string>;
  create: (code: string) => Promise<T>;
  maxAttempts?: number;
}): Promise<T> {
  const max = opts.maxAttempts ?? 5;
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < max; attempt++) {
    const code = await opts.generate();
    try {
      return await opts.create(code);
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        lastErr = err;
        continue;
      }
      throw err;
    }
  }
  throw lastErr ?? new Error("Failed to generate a unique code after retries");
}
