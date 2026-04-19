/**
 * Sequential code generator for master data (customers, machines, materials, ...).
 *
 * Unlike `doc-numbering.ts` (which uses a dedicated DocumentSequence table keyed
 * by year), master data codes don't reset yearly and are created infrequently
 * enough that we can scan existing rows + retry on unique-constraint collision.
 *
 * Format: `<prefix><N>` zero-padded, e.g. "C-0001", "M-0042".
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

/**
 * Generate the next customer code for a tenant (e.g. "C-0001").
 * Only scans codes that match the default prefix — manually-entered codes
 * with other formats are ignored.
 */
export async function generateCustomerCode(tenantId: string): Promise<string> {
  const prefix = "C-";
  const rows = await prisma.customer.findMany({
    where: { tenantId, code: { startsWith: prefix } },
    select: { code: true },
  });
  return nextCodeFromExisting(rows.map((r) => r.code), { prefix });
}

/**
 * Generate the next CNC machine code for a tenant (e.g. "M-0001").
 */
export async function generateMachineCode(tenantId: string): Promise<string> {
  const prefix = "M-";
  const rows = await prisma.cncMachine.findMany({
    where: { tenantId, code: { startsWith: prefix } },
    select: { code: true },
  });
  return nextCodeFromExisting(rows.map((r) => r.code), { prefix });
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
