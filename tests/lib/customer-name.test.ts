import { describe, expect, it } from "vitest";
import {
  JURISTIC_TYPE_OPTIONS,
  INDIVIDUAL_TITLE_OPTIONS,
  formatCustomerDisplayName,
  getIndividualTitleLabelTh,
  getJuristicTypeLabelTh,
} from "@/lib/customer-name";

describe("customer legal display name helpers", () => {
  it.each([
    ["COMPANY_LTD", "เอบีซี", "บริษัท เอบีซี จำกัด"],
    ["PUBLIC_CO", "เอบีซี", "บริษัท เอบีซี จำกัด (มหาชน)"],
    ["LIMITED_PARTNERSHIP", "เอบีซี", "ห้างหุ้นส่วนจำกัด เอบีซี"],
    ["ORDINARY_PARTNERSHIP", "เอบีซี", "ห้างหุ้นส่วนสามัญ เอบีซี"],
    ["SHOP", "สมชายการช่าง", "ร้าน สมชายการช่าง"],
    ["PERSON_GROUP", "เอ บี", "คณะบุคคล เอ บี"],
    ["FOUNDATION", "เอบีซี", "มูลนิธิ เอบีซี"],
    ["ASSOCIATION", "เอบีซี", "สมาคม เอบีซี"],
    ["JOINT_VENTURE", "เอบีซี", "กิจการร่วมค้า เอบีซี"],
    ["OTHER_JURISTIC", "เอบีซี", "เอบีซี"],
  ] as const)("formats %s names", (juristicType, name, expected) => {
    expect(formatCustomerDisplayName({ name, juristicType })).toBe(expected);
  });

  it.each([
    ["MR", "นาย สมชาย ใจดี"],
    ["MRS", "นาง สมชาย ใจดี"],
    ["MISS", "นางสาว สมชาย ใจดี"],
    ["KHUN", "คุณ สมชาย ใจดี"],
    ["NONE", "สมชาย ใจดี"],
  ] as const)("formats individual title %s", (individualTitle, expected) => {
    expect(
      formatCustomerDisplayName({
        name: "สมชาย ใจดี",
        juristicType: "INDIVIDUAL",
        individualTitle,
      }),
    ).toBe(expected);
  });

  it("formats individual OTHER title from custom text", () => {
    expect(
      formatCustomerDisplayName({
        name: "สมชาย ใจดี",
        juristicType: "INDIVIDUAL",
        individualTitle: "OTHER",
        individualTitleOther: "ดร.",
      }),
    ).toBe("ดร. สมชาย ใจดี");
  });

  it("uses Thai labels for dropdown options", () => {
    expect(getJuristicTypeLabelTh("COMPANY_LTD")).toBe("บริษัทจำกัด");
    expect(getJuristicTypeLabelTh("PUBLIC_CO")).toBe("บริษัทมหาชนจำกัด");
    expect(getJuristicTypeLabelTh("SHOP")).toBe("ร้านค้า");
    expect(getJuristicTypeLabelTh("ORDINARY_PARTNERSHIP")).toBe(
      "ห้างหุ้นส่วนสามัญ",
    );
    expect(getIndividualTitleLabelTh("OTHER")).toBe("อื่นๆ");

    expect(JURISTIC_TYPE_OPTIONS.map((option) => option.labelTh)).not.toContain(
      "COMPANY_LTD",
    );
    expect(INDIVIDUAL_TITLE_OPTIONS.map((option) => option.labelTh)).toContain(
      "ไม่มี",
    );
  });

  it("trims and collapses extra spacing in the base name", () => {
    expect(
      formatCustomerDisplayName({
        name: "  เอบีซี   แมชชีน  ",
        juristicType: "COMPANY_LTD",
      }),
    ).toBe("บริษัท เอบีซี แมชชีน จำกัด");
  });
});
