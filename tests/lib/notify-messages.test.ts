import { describe, expect, it } from "vitest";
import {
  escapeHtml,
  formatBaht,
  buildSignupMessage,
  buildManualTransferMessage,
  buildActivatedMessage,
  buildPaymentFailedMessage,
  buildTrialCronMessage,
  buildRenewalCronMessage,
} from "@/lib/notify-messages";

describe("escapeHtml", () => {
  it("escapes &, <, > for Telegram HTML mode", () => {
    expect(escapeHtml("A & B <c> \"d\"")).toBe("A &amp; B &lt;c&gt; \"d\"");
  });
  it("leaves plain text untouched", () => {
    expect(escapeHtml("บริษัท ABC จำกัด")).toBe("บริษัท ABC จำกัด");
  });
});

describe("formatBaht", () => {
  it("converts satang to 2-decimal baht", () => {
    expect(formatBaht(123400)).toBe("1,234.00");
  });
  it("handles zero", () => {
    expect(formatBaht(0)).toBe("0.00");
  });
  it("rounds fractional satang display to 2 decimals", () => {
    expect(formatBaht(99)).toBe("0.99");
  });
});

describe("buildSignupMessage", () => {
  it("includes tenant, email and plan", () => {
    const msg = buildSignupMessage({
      tenantName: "บริษัท ทดสอบ",
      email: "a@b.com",
      planName: "Free",
    });
    expect(msg).toContain("ลูกค้าใหม่สมัครใช้งาน");
    expect(msg).toContain("บริษัท ทดสอบ");
    expect(msg).toContain("a@b.com");
    expect(msg).toContain("Free");
  });
  it("escapes html-sensitive characters in tenant name", () => {
    const msg = buildSignupMessage({
      tenantName: "A & <B>",
      email: "x@y.com",
      planName: "Pro",
    });
    expect(msg).toContain("A &amp; &lt;B&gt;");
    expect(msg).not.toContain("<B>");
  });
});

describe("buildManualTransferMessage", () => {
  it("shows amount and monthly label", () => {
    const msg = buildManualTransferMessage({
      tenantName: "ACME",
      planName: "Pro",
      billingCycle: "MONTHLY",
      totalSatang: 53500,
    });
    expect(msg).toContain("มีการโอนเงินรอยืนยัน");
    expect(msg).toContain("฿535.00");
    expect(msg).toContain("รายเดือน");
  });
  it("shows yearly label for YEARLY cycle", () => {
    const msg = buildManualTransferMessage({
      tenantName: "ACME",
      planName: "Pro",
      billingCycle: "YEARLY",
      totalSatang: 100000,
    });
    expect(msg).toContain("รายปี");
  });
});

describe("buildActivatedMessage", () => {
  it("maps a known gateway to its Thai label", () => {
    const msg = buildActivatedMessage({
      tenantName: "ACME",
      planName: "Pro",
      totalSatang: 10700,
      gateway: "MANUAL",
    });
    expect(msg).toContain("ชำระเงินสำเร็จ");
    expect(msg).toContain("โอนผ่านบัญชี");
    expect(msg).toContain("฿107.00");
  });
  it("handles null gateway without throwing", () => {
    const msg = buildActivatedMessage({
      tenantName: "ACME",
      planName: "Pro",
      totalSatang: 0,
      gateway: null,
    });
    expect(msg).toContain("ช่องทาง: -");
  });
});

describe("buildPaymentFailedMessage", () => {
  it("includes the failure reason", () => {
    const msg = buildPaymentFailedMessage({
      tenantName: "ACME",
      planName: "Pro",
      reason: "บัตรถูกปฏิเสธ",
    });
    expect(msg).toContain("ชำระเงินไม่สำเร็จ");
    expect(msg).toContain("บัตรถูกปฏิเสธ");
  });
});

describe("buildTrialCronMessage", () => {
  it("returns null when nothing happened", () => {
    expect(buildTrialCronMessage({ suspended: [], reminders: [] })).toBeNull();
  });
  it("lists reminders and suspensions", () => {
    const msg = buildTrialCronMessage({
      suspended: ["Beta Co"],
      reminders: [{ name: "Alpha Co", daysLeft: 3 }],
    });
    expect(msg).toContain("Alpha Co");
    expect(msg).toContain("เหลือ 3 วัน");
    expect(msg).toContain("Beta Co");
  });
  it("truncates long reminder lists with an overflow note", () => {
    const reminders = Array.from({ length: 25 }, (_, i) => ({
      name: `T${i}`,
      daysLeft: 1,
    }));
    const msg = buildTrialCronMessage({ suspended: [], reminders })!;
    expect(msg).toContain("…และอีก 5");
  });
});

describe("buildRenewalCronMessage", () => {
  it("returns null when nothing happened", () => {
    expect(
      buildRenewalCronMessage({ renewed: [], failed: [], expired: [] })
    ).toBeNull();
  });
  it("summarises renewed / failed / expired counts", () => {
    const msg = buildRenewalCronMessage({
      renewed: ["A"],
      failed: ["B", "C"],
      expired: ["D"],
    })!;
    expect(msg).toContain("ต่ออายุสำเร็จ: 1");
    expect(msg).toContain("ต่ออายุล้มเหลว: 2");
    expect(msg).toContain("หมดอายุ/ระงับ: 1");
  });
});
