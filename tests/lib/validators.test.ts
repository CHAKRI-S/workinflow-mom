import { describe, expect, it } from "vitest";

import { customerCreateSchema } from "@/lib/validators/customer";
import { invoiceCreateSchema } from "@/lib/validators/invoice";
import { quotationCreateSchema } from "@/lib/validators/quotation";
import { receiptCreateSchema } from "@/lib/validators/receipt";
import { salesOrderCreateSchema, salesOrderUpdateSchema } from "@/lib/validators/sales-order";

const baseLine = {
  productId: "prod_1",
  quantity: 1,
  unitPrice: 100,
  discountPercent: 0,
  sortOrder: 0,
};

const baseQuotation = {
  customerId: "cust_1",
  validUntil: "2026-06-01",
  discountPercent: 0,
  lines: [baseLine],
};

const baseSalesOrder = {
  customerId: "cust_1",
  requestedDate: "2026-06-01",
  depositPercent: 0,
  lines: [baseLine],
};

const baseInvoice = {
  salesOrderId: "so_1",
  invoiceType: "FULL",
  dueDate: "2026-06-01",
  lines: [
    {
      description: "งานกลึง CNC",
      quantity: 1,
      unitPrice: 100,
      sortOrder: 0,
    },
  ],
};

describe("document validators", () => {
  it("defaults quotation tax type and currency safely", () => {
    const parsed = quotationCreateSchema.parse(baseQuotation);

    expect(parsed.taxType).toBe("VAT_EXCLUSIVE");
    expect(parsed.currencyCode).toBe("THB");
  });

  it("accepts selected quotation tax type and supported currency", () => {
    const parsed = quotationCreateSchema.parse({
      ...baseQuotation,
      taxType: "NO_VAT",
      currencyCode: "usd",
    });

    expect(parsed.taxType).toBe("NO_VAT");
    expect(parsed.currencyCode).toBe("USD");
  });

  it("rejects unsupported quotation currency", () => {
    expect(() =>
      quotationCreateSchema.parse({ ...baseQuotation, currencyCode: "BTC" }),
    ).toThrow();
  });

  it("adds tax type and currency defaults to downstream document schemas", () => {
    expect(salesOrderCreateSchema.parse(baseSalesOrder)).toMatchObject({
      taxType: "VAT_EXCLUSIVE",
      currencyCode: "THB",
    });
    expect(invoiceCreateSchema.parse(baseInvoice)).toMatchObject({
      taxType: "VAT_EXCLUSIVE",
      currencyCode: "THB",
    });
    expect(
      receiptCreateSchema.parse({
        invoiceId: "inv_1",
        grossAmount: 107,
        payerName: "บริษัท เอบีซี จำกัด",
      }),
    ).toMatchObject({ taxType: "VAT_EXCLUSIVE", currencyCode: "THB" });
  });

  it("does not inject document defaults into sales order PATCH payloads", () => {
    const parsed = salesOrderUpdateSchema.parse({ customerId: "cust_2" });

    expect(parsed.taxType).toBeUndefined();
    expect(parsed.currencyCode).toBeUndefined();
    expect(parsed.vatModePolicy).toBeUndefined();
    expect(parsed.billingNature).toBeUndefined();
  });
});

describe("customer validator legal name fields", () => {
  it("accepts new juristic types and individual title fields", () => {
    const parsed = customerCreateSchema.parse({
      name: "สมชาย ใจดี",
      customerType: "OEM",
      isVatRegistered: false,
      paymentTermDays: 30,
      juristicType: "INDIVIDUAL",
      individualTitle: "OTHER",
      individualTitleOther: "ดร.",
    });

    expect(parsed.juristicType).toBe("INDIVIDUAL");
    expect(parsed.individualTitle).toBe("OTHER");
    expect(parsed.individualTitleOther).toBe("ดร.");
  });

  it("requires custom title text when individual title is OTHER", () => {
    expect(() =>
      customerCreateSchema.parse({
        name: "สมชาย ใจดี",
        customerType: "OEM",
        isVatRegistered: false,
        paymentTermDays: 30,
        juristicType: "INDIVIDUAL",
        individualTitle: "OTHER",
        individualTitleOther: " ",
      }),
    ).toThrow();
  });

  it("clears individual title fields for non-individual customers", () => {
    const parsed = customerCreateSchema.parse({
      name: "สมชายการช่าง",
      customerType: "OEM",
      isVatRegistered: true,
      paymentTermDays: 30,
      juristicType: "SHOP",
      individualTitle: "OTHER",
      individualTitleOther: "ดร.",
    });

    expect(parsed.juristicType).toBe("SHOP");
    expect(parsed.individualTitle).toBeUndefined();
    expect(parsed.individualTitleOther).toBeUndefined();
  });

  it("accepts newly supported juristic types", () => {
    for (const juristicType of ["SHOP", "PERSON_GROUP", "ORDINARY_PARTNERSHIP"] as const) {
      const parsed = customerCreateSchema.parse({
        name: "เอสพีแมชชีน",
        customerType: "OEM",
        isVatRegistered: true,
        paymentTermDays: 30,
        juristicType,
      });

      expect(parsed.juristicType).toBe(juristicType);
    }
  });
});
