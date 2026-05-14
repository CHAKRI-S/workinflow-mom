import { describe, expect, it } from "vitest";

import {
  getAllOptionLabelTh,
  getBillingNatureLabelTh,
  getBomMaterialSourcingLabelTh,
  getConsumableCategoryLabelTh,
  getCustomerTypeLabelTh,
  getDrawingSourceLabelTh,
  getFinanceStatusLabelTh,
  getInvoiceTypeLabelTh,
  getMachineStatusLabelTh,
  getMachineTypeLabelTh,
  getMaintenanceTypeLabelTh,
  getMaterialReadinessLabelTh,
  getMaterialUnitLabelTh,
  getPaymentMethodLabelTh,
  getProductKindLabelTh,
  getPurchaseOrderLineTypeLabelTh,
  getQuotationStatusLabelTh,
  getSalesOrderStatusLabelTh,
  getUserRoleLabelTh,
  getVatModePolicyLabelTh,
  getVatPriceModeLabelTh,
  getVatRegistrationLabelTh,
  getWhtCertStatusLabelTh,
  getWorkOrderPriorityLabelTh,
  getWorkOrderStatusLabelTh,
} from "@/lib/select-labels";

describe("central Thai select labels", () => {
  it("labels product, VAT, drawing, billing, and BOM enums in Thai", () => {
    expect(getProductKindLabelTh("GOODS")).toBe("สินค้า");
    expect(getProductKindLabelTh("SERVICE")).toBe("บริการ");
    expect(getVatPriceModeLabelTh("EXCLUSIVE")).toBe("VAT นอก");
    expect(getVatPriceModeLabelTh("INCLUSIVE")).toBe("VAT ใน");
    expect(getVatPriceModeLabelTh("NONE")).toBe("ไม่มี VAT");
    expect(getVatModePolicyLabelTh("PER_LINE")).toBe("ตามรายการ");
    expect(getVatModePolicyLabelTh("FORCE_EXCLUSIVE")).toBe("VAT นอกทั้งบิล");
    expect(getVatModePolicyLabelTh("FORCE_INCLUSIVE")).toBe("VAT ในทั้งบิล");
    expect(getDrawingSourceLabelTh("TENANT_OWNED")).toBe("แบบเรา");
    expect(getDrawingSourceLabelTh("CUSTOMER_PROVIDED")).toBe("แบบลูกค้า");
    expect(getDrawingSourceLabelTh("JOINT_DEVELOPMENT")).toBe("ร่วมพัฒนา");
    expect(getBillingNatureLabelTh("GOODS")).toBe("ขายสินค้า");
    expect(getBillingNatureLabelTh("MANUFACTURING_SERVICE")).toBe("รับจ้างทำของ");
    expect(getBillingNatureLabelTh("MIXED")).toBe("ผสม");
    expect(getBomMaterialSourcingLabelTh("STOCK_CUT")).toBe("สต๊อกแล้วแบ่งตัด");
    expect(getBomMaterialSourcingLabelTh("JOB_SPECIFIC")).toBe("สั่งเฉพาะงาน/สินค้านี้");
  });

  it("labels manufacturing and master-data enums in Thai", () => {
    expect(getMaterialUnitLabelTh("PCS")).toBe("ชิ้น");
    expect(getMaterialUnitLabelTh("KG")).toBe("กก.");
    expect(getMaterialUnitLabelTh("SHEET")).toBe("แผ่น");
    expect(getUserRoleLabelTh("OWNER")).toBe("เจ้าของ");
    expect(getUserRoleLabelTh("ADMIN")).toBe("ผู้ดูแลระบบ");
    expect(getUserRoleLabelTh("MANAGER")).toBe("ผู้จัดการ");
    expect(getUserRoleLabelTh("STAFF")).toBe("พนักงาน");
    expect(getUserRoleLabelTh("VIEWER")).toBe("ผู้ดูอย่างเดียว");
    expect(getWorkOrderStatusLabelTh("IN_PROGRESS")).toBe("กำลังผลิต");
    expect(getWorkOrderStatusLabelTh("QC_FINAL")).toBe("ตรวจ QC สุดท้าย");
    expect(getWorkOrderPriorityLabelTh("LOW")).toBe("ต่ำ");
    expect(getWorkOrderPriorityLabelTh("MEDIUM")).toBe("ปานกลาง");
    expect(getWorkOrderPriorityLabelTh("NORMAL")).toBe("ปานกลาง");
    expect(getWorkOrderPriorityLabelTh("HIGH")).toBe("สูง");
    expect(getWorkOrderPriorityLabelTh("URGENT")).toBe("เร่งด่วน");
    expect(getMachineTypeLabelTh("CNC_MILLING")).toBe("CNC Milling");
    expect(getMachineStatusLabelTh("AVAILABLE")).toBe("พร้อมใช้งาน");
    expect(getConsumableCategoryLabelTh("CUTTING_TOOL")).toBe("เครื่องมือตัด");
    expect(getPurchaseOrderLineTypeLabelTh("MATERIAL")).toBe("วัตถุดิบ");
  });

  it("labels finance/payment/filter values and falls back safely for dynamic values", () => {
    expect(getFinanceStatusLabelTh("DRAFT")).toBe("ร่าง");
    expect(getFinanceStatusLabelTh("PAID")).toBe("ชำระแล้ว");
    expect(getPaymentMethodLabelTh("BANK_TRANSFER")).toBe("โอนเงิน");
    expect(getPaymentMethodLabelTh("CASH")).toBe("เงินสด");
    expect(getAllOptionLabelTh("ALL")).toBe("ทั้งหมด");
    expect(getAllOptionLabelTh()).toBe("ทั้งหมด");
    expect(getProductKindLabelTh("CUSTOM_DYNAMIC")).toBe("CUSTOM_DYNAMIC");
    expect(getProductKindLabelTh(null)).toBe("");
  });

  it("labels remaining admin, sales, production, and finance select enums in Thai", () => {
    expect(getCustomerTypeLabelTh("OEM")).toBe("OEM");
    expect(getCustomerTypeLabelTh("END_USER")).toBe("ผู้ใช้งานปลายทาง");
    expect(getQuotationStatusLabelTh("APPROVED")).toBe("อนุมัติแล้ว");
    expect(getSalesOrderStatusLabelTh("AWAITING_PAYMENT")).toBe("รอชำระเงิน");
    expect(getVatRegistrationLabelTh("true")).toBe("จดทะเบียน VAT แล้ว");
    expect(getVatRegistrationLabelTh("false")).toBe("ยังไม่จดทะเบียน VAT");
    expect(getMaterialReadinessLabelTh("NOT_ORDERED")).toBe("ยังไม่ได้สั่ง");
    expect(getMaintenanceTypeLabelTh("CALIBRATION")).toBe("สอบเทียบ");
    expect(getInvoiceTypeLabelTh("REMAINING")).toBe("ใบแจ้งหนี้ส่วนที่เหลือ");
    expect(getWhtCertStatusLabelTh("MISSING_OVERDUE")).toBe("เกินกำหนด");
  });
});
