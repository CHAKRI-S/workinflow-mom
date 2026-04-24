import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * Vitest config — pure-function unit tests only (no JSDOM, no React tree).
 *
 * Scope kept deliberately narrow: tax math, doc numbering, slug generation.
 * Anything that needs Prisma, Next, or browser APIs belongs in an integration
 * suite, not here. Adding JSDOM or React Testing Library later is additive;
 * this config can keep running as-is.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    // No globals — tests import { describe, it, expect } explicitly.
    globals: false,
    // Fail CI on any test leak to keep the suite honest.
    passWithNoTests: false,
    reporters: ["default"],
  },
});
