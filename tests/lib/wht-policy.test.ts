import { describe, it, expect } from "vitest";
import { computeWht, resolveWhtPolicy } from "@/lib/validators/receipt";

/**
 * WHT math + policy resolution for the receipt create flow.
 * The rules here codify ม.3 เตรส + Phase 8.8 edge cases.
 */

describe("computeWht", () => {
  it("3% of 10,000 = 300 WHT, 9,700 net", () => {
    expect(computeWht({ grossAmount: 10_000, whtRate: 3 })).toEqual({
      whtAmount: 300,
      netAmount: 9700,
    });
  });

  it("0% → 0 WHT, gross == net", () => {
    expect(computeWht({ grossAmount: 5_350, whtRate: 0 })).toEqual({
      whtAmount: 0,
      netAmount: 5350,
    });
  });

  it("rounds half-away-from-zero to 2 decimal places", () => {
    // 1,234.56 * 3% = 37.0368 → round to 37.04
    expect(computeWht({ grossAmount: 1234.56, whtRate: 3 })).toEqual({
      whtAmount: 37.04,
      netAmount: 1197.52,
    });
  });

  it("handles satang-precision input without drift", () => {
    // 7,777.77 * 3% = 233.3331 → 233.33
    const res = computeWht({ grossAmount: 7777.77, whtRate: 3 });
    expect(res.whtAmount).toBe(233.33);
    expect(res.netAmount).toBe(7544.44);
  });
});

describe("resolveWhtPolicy", () => {
  // Base TH-customer args to keep tests readable.
  const baseTH = {
    customerCountry: "TH" as const,
    hasCert: false,
    isDeposit: false,
  };

  describe("base case: OEM goods manufacturer (factor profile)", () => {
    it("GOODS + withholdsTax=false → 0% (no WHT, no cert tracking)", () => {
      expect(
        resolveWhtPolicy({
          ...baseTH,
          billingNature: "GOODS",
          customerWithholdsTax: false,
        }),
      ).toEqual({ whtRate: 0, certStatus: "NOT_APPLICABLE" });
    });

    it("GOODS + withholdsTax=true → STILL 0% (goods don't trigger ม.3 เตรส)", () => {
      expect(
        resolveWhtPolicy({
          ...baseTH,
          billingNature: "GOODS",
          customerWithholdsTax: true,
        }),
      ).toEqual({ whtRate: 0, certStatus: "NOT_APPLICABLE" });
    });
  });

  describe("service case: ม.3 เตรส fires", () => {
    it("MANUFACTURING_SERVICE + withholdsTax=true → 3%, PENDING cert", () => {
      expect(
        resolveWhtPolicy({
          ...baseTH,
          billingNature: "MANUFACTURING_SERVICE",
          customerWithholdsTax: true,
        }),
      ).toEqual({ whtRate: 3, certStatus: "PENDING" });
    });

    it("MANUFACTURING_SERVICE + cert already in hand → 3%, RECEIVED", () => {
      expect(
        resolveWhtPolicy({
          ...baseTH,
          hasCert: true,
          billingNature: "MANUFACTURING_SERVICE",
          customerWithholdsTax: true,
        }),
      ).toEqual({ whtRate: 3, certStatus: "RECEIVED" });
    });

    it("MANUFACTURING_SERVICE but customer doesn't withhold → 0%", () => {
      // Some small businesses don't withhold even when law says they should.
      expect(
        resolveWhtPolicy({
          ...baseTH,
          billingNature: "MANUFACTURING_SERVICE",
          customerWithholdsTax: false,
        }),
      ).toEqual({ whtRate: 0, certStatus: "NOT_APPLICABLE" });
    });

    it("MIXED + withholdsTax=true → 3% (service portion drives the rate)", () => {
      expect(
        resolveWhtPolicy({
          ...baseTH,
          billingNature: "MIXED",
          customerWithholdsTax: true,
        }),
      ).toEqual({ whtRate: 3, certStatus: "PENDING" });
    });
  });

  describe("Phase 8.8 edge case — deposit skip", () => {
    it("deposit skips WHT even when service + withholdsTax", () => {
      expect(
        resolveWhtPolicy({
          ...baseTH,
          isDeposit: true,
          billingNature: "MANUFACTURING_SERVICE",
          customerWithholdsTax: true,
        }),
      ).toEqual({ whtRate: 0, certStatus: "NOT_APPLICABLE" });
    });

    it("deposit skip beats explicit override", () => {
      expect(
        resolveWhtPolicy({
          ...baseTH,
          isDeposit: true,
          override: 3,
          billingNature: "MANUFACTURING_SERVICE",
          customerWithholdsTax: true,
        }),
      ).toEqual({ whtRate: 0, certStatus: "NOT_APPLICABLE" });
    });
  });

  describe("Phase 8.8 edge case — foreign customer", () => {
    it("US customer → no WHT (Thai WHT doesn't apply abroad)", () => {
      expect(
        resolveWhtPolicy({
          ...baseTH,
          customerCountry: "US",
          billingNature: "MANUFACTURING_SERVICE",
          customerWithholdsTax: true,
        }),
      ).toEqual({ whtRate: 0, certStatus: "NOT_APPLICABLE" });
    });

    it("foreign skip beats override", () => {
      expect(
        resolveWhtPolicy({
          ...baseTH,
          customerCountry: "JP",
          override: 3,
          billingNature: "MANUFACTURING_SERVICE",
          customerWithholdsTax: true,
        }),
      ).toEqual({ whtRate: 0, certStatus: "NOT_APPLICABLE" });
    });

    it("undefined country is treated as TH (back-compat)", () => {
      expect(
        resolveWhtPolicy({
          hasCert: false,
          isDeposit: false,
          billingNature: "MANUFACTURING_SERVICE",
          customerWithholdsTax: true,
          // customerCountry omitted
        }),
      ).toEqual({ whtRate: 3, certStatus: "PENDING" });
    });
  });

  describe("explicit rate override", () => {
    it("override=5 → 5%, PENDING without cert", () => {
      expect(
        resolveWhtPolicy({
          ...baseTH,
          override: 5,
          billingNature: "MANUFACTURING_SERVICE",
          customerWithholdsTax: true,
        }),
      ).toEqual({ whtRate: 5, certStatus: "PENDING" });
    });

    it("override=0 clears the rate even for a service + withholder", () => {
      expect(
        resolveWhtPolicy({
          ...baseTH,
          override: 0,
          billingNature: "MANUFACTURING_SERVICE",
          customerWithholdsTax: true,
        }),
      ).toEqual({ whtRate: 0, certStatus: "NOT_APPLICABLE" });
    });
  });
});
