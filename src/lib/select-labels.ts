type LabelMap = Readonly<Record<string, string>>;

function getLabelTh(value: string | null | undefined, labels: LabelMap): string {
  if (value == null || value === "") return "";
  return labels[value] ?? value;
}

const PRODUCT_KIND_LABELS_TH = {
  GOODS: "สินค้า",
  SERVICE: "บริการ",
} as const satisfies LabelMap;

const DRAWING_SOURCE_LABELS_TH = {
  TENANT_OWNED: "แบบเรา",
  CUSTOMER_PROVIDED: "แบบลูกค้า",
  JOINT_DEVELOPMENT: "ร่วมพัฒนา",
} as const satisfies LabelMap;

const VAT_PRICE_MODE_LABELS_TH = {
  EXCLUSIVE: "VAT นอก",
  INCLUSIVE: "VAT ใน",
  NONE: "ไม่มี VAT",
} as const satisfies LabelMap;

const VAT_MODE_POLICY_LABELS_TH = {
  PER_LINE: "ตามรายการ",
  FORCE_EXCLUSIVE: "VAT นอกทั้งบิล",
  FORCE_INCLUSIVE: "VAT ในทั้งบิล",
} as const satisfies LabelMap;

const BILLING_NATURE_LABELS_TH = {
  GOODS: "ขายสินค้า",
  MANUFACTURING_SERVICE: "รับจ้างทำของ",
  MIXED: "ผสม",
} as const satisfies LabelMap;

const MATERIAL_UNIT_LABELS_TH = {
  PCS: "ชิ้น",
  KG: "กก.",
  M: "เมตร",
  MM: "มม.",
  CM: "ซม.",
  SHEET: "แผ่น",
  BAR: "แท่ง",
  ROD: "เพลา",
  BLOCK: "บล็อก",
  SET: "ชุด",
  BOX: "กล่อง",
} as const satisfies LabelMap;

const BOM_MATERIAL_MODE_LABELS_TH = {
  EXISTING: "ใช้วัตถุดิบที่มีอยู่",
  NEW: "สร้างวัตถุดิบใหม่",
} as const satisfies LabelMap;

const BOM_MATERIAL_SOURCING_LABELS_TH = {
  STOCK_CUT: "สต๊อกแล้วแบ่งตัด",
  JOB_SPECIFIC: "สั่งเฉพาะงาน/สินค้านี้",
} as const satisfies LabelMap;

const USER_ROLE_LABELS_TH = {
  OWNER: "เจ้าของ",
  ADMIN: "ผู้ดูแลระบบ",
  MANAGER: "ผู้จัดการ",
  STAFF: "พนักงาน",
  VIEWER: "ผู้ดูอย่างเดียว",
  PLANNER: "วางแผนผลิต",
  SALES: "ฝ่ายขาย",
  OPERATOR: "ผู้ปฏิบัติงาน",
  QC: "ตรวจคุณภาพ",
  ACCOUNTING: "บัญชี",
} as const satisfies LabelMap;

const WORK_ORDER_STATUS_LABELS_TH = {
  PENDING: "รอดำเนินการ",
  RELEASED: "ปล่อยงานแล้ว",
  IN_PROGRESS: "กำลังผลิต",
  QC_MACHINING: "ตรวจ QC หลัง CNC",
  SENT_TO_PAINTING: "ส่งทำสี",
  PAINTING_DONE: "ทำสีเสร็จ",
  ENGRAVING: "แกะโลโก้",
  QC_FINAL: "ตรวจ QC สุดท้าย",
  COMPLETED: "เสร็จสิ้น",
  ON_HOLD: "พักงาน",
  CANCELLED: "ยกเลิก",
} as const satisfies LabelMap;

const WORK_ORDER_PRIORITY_LABELS_TH = {
  LOW: "ต่ำ",
  MEDIUM: "ปานกลาง",
  NORMAL: "ปานกลาง",
  HIGH: "สูง",
  URGENT: "เร่งด่วน",
} as const satisfies LabelMap;

const MACHINE_TYPE_LABELS_TH = {
  CNC_MILLING: "CNC Milling",
  CNC_LATHE: "CNC Lathe",
  CNC_ROUTER: "CNC Router",
  CNC_ENGRAVING: "CNC Engraving",
  OTHER: "อื่นๆ",
} as const satisfies LabelMap;

const MACHINE_STATUS_LABELS_TH = {
  AVAILABLE: "พร้อมใช้งาน",
  IN_USE: "กำลังใช้งาน",
  MAINTENANCE: "ซ่อมบำรุง",
  OFFLINE: "ปิดใช้งาน",
} as const satisfies LabelMap;

const CONSUMABLE_CATEGORY_LABELS_TH = {
  CUTTING_TOOL: "เครื่องมือตัด",
  COOLANT: "น้ำหล่อเย็น/น้ำมัน",
  ABRASIVE: "วัสดุขัดเจียร",
  MEASURING: "เครื่องมือวัด",
  SAFETY: "อุปกรณ์ความปลอดภัย",
  OTHER: "อื่นๆ",
} as const satisfies LabelMap;

const PURCHASE_ORDER_LINE_TYPE_LABELS_TH = {
  MATERIAL: "วัตถุดิบ",
  CONSUMABLE: "วัสดุสิ้นเปลือง",
  OTHER: "อื่นๆ",
} as const satisfies LabelMap;

const FINANCE_STATUS_LABELS_TH = {
  DRAFT: "ร่าง",
  ISSUED: "ออกแล้ว",
  SENT: "ส่งแล้ว",
  PARTIALLY_PAID: "ชำระบางส่วน",
  PAID: "ชำระแล้ว",
  OVERDUE: "เกินกำหนด",
  CANCELLED: "ยกเลิก",
  APPLIED: "หักกับเอกสารแล้ว",
  RECEIVED: "รับแล้ว",
  VERIFIED: "ตรวจสอบแล้ว",
  PENDING: "รอดำเนินการ",
  NOT_APPLICABLE: "ไม่เกี่ยวข้อง",
  MISSING_OVERDUE: "ขาด/เกินกำหนด",
} as const satisfies LabelMap;

const PAYMENT_METHOD_LABELS_TH = {
  BANK_TRANSFER: "โอนเงิน",
  CASH: "เงินสด",
  CHEQUE: "เช็ค",
  CREDIT_CARD: "บัตรเครดิต",
  OTHER: "อื่นๆ",
} as const satisfies LabelMap;

const CUSTOMER_TYPE_LABELS_TH = {
  OEM: "OEM",
  DEALER: "ตัวแทนจำหน่าย",
  END_USER: "ผู้ใช้งานปลายทาง",
  OTHER: "อื่นๆ",
} as const satisfies LabelMap;

const QUOTATION_STATUS_LABELS_TH = {
  DRAFT: "ร่าง",
  SENT: "ส่งแล้ว",
  REVISED: "แก้ไขแล้ว",
  APPROVED: "อนุมัติแล้ว",
  REJECTED: "ไม่อนุมัติ",
  EXPIRED: "หมดอายุ",
  CANCELLED: "ยกเลิก",
} as const satisfies LabelMap;

const SALES_ORDER_STATUS_LABELS_TH = {
  CONFIRMED: "ยืนยันแล้ว",
  DEPOSIT_PENDING: "รอมัดจำ",
  IN_PRODUCTION: "กำลังผลิต",
  PAINTING: "ทำสี",
  ENGRAVING: "แกะโลโก้",
  QC_FINAL: "ตรวจ QC สุดท้าย",
  PACKING: "แพ็คสินค้า",
  AWAITING_PAYMENT: "รอชำระเงิน",
  SHIPPED: "จัดส่งแล้ว",
  COMPLETED: "เสร็จสิ้น",
  CANCELLED: "ยกเลิก",
} as const satisfies LabelMap;

const MATERIAL_READINESS_LABELS_TH = {
  READY: "พร้อมแล้ว",
  ORDERED: "สั่งแล้ว",
  NOT_ORDERED: "ยังไม่ได้สั่ง",
  PARTIAL: "มีบางส่วน",
} as const satisfies LabelMap;

const MAINTENANCE_TYPE_LABELS_TH = {
  PREVENTIVE: "ป้องกัน",
  CORRECTIVE: "แก้ไข",
  INSPECTION: "ตรวจสอบ",
  CALIBRATION: "สอบเทียบ",
} as const satisfies LabelMap;

const INVOICE_TYPE_LABELS_TH = {
  DEPOSIT: "ใบแจ้งหนี้มัดจำ",
  FULL: "ใบแจ้งหนี้เต็มจำนวน",
  REMAINING: "ใบแจ้งหนี้ส่วนที่เหลือ",
  PARTIAL: "ใบแจ้งหนี้บางส่วน",
} as const satisfies LabelMap;

const WHT_CERT_STATUS_LABELS_TH = {
  NOT_APPLICABLE: "ไม่เข้าข่าย",
  PENDING: "รอรับ cert",
  RECEIVED: "รับ cert แล้ว",
  VERIFIED: "ตรวจสอบแล้ว",
  MISSING_OVERDUE: "เกินกำหนด",
} as const satisfies LabelMap;

export function getProductKindLabelTh(value?: string | null): string {
  return getLabelTh(value, PRODUCT_KIND_LABELS_TH);
}

export function getDrawingSourceLabelTh(value?: string | null): string {
  return getLabelTh(value, DRAWING_SOURCE_LABELS_TH);
}

export function getVatPriceModeLabelTh(value?: string | null): string {
  return getLabelTh(value, VAT_PRICE_MODE_LABELS_TH);
}

export function getVatModePolicyLabelTh(value?: string | null): string {
  return getLabelTh(value, VAT_MODE_POLICY_LABELS_TH);
}

export function getBillingNatureLabelTh(value?: string | null): string {
  return getLabelTh(value, BILLING_NATURE_LABELS_TH);
}

export function getMaterialUnitLabelTh(value?: string | null): string {
  return getLabelTh(value, MATERIAL_UNIT_LABELS_TH);
}

export function getBomMaterialModeLabelTh(value?: string | null): string {
  return getLabelTh(value, BOM_MATERIAL_MODE_LABELS_TH);
}

export function getBomMaterialSourcingLabelTh(value?: string | null): string {
  return getLabelTh(value, BOM_MATERIAL_SOURCING_LABELS_TH);
}

export function getUserRoleLabelTh(value?: string | null): string {
  return getLabelTh(value, USER_ROLE_LABELS_TH);
}

export function getWorkOrderStatusLabelTh(value?: string | null): string {
  return getLabelTh(value, WORK_ORDER_STATUS_LABELS_TH);
}

export function getWorkOrderPriorityLabelTh(value?: string | null): string {
  return getLabelTh(value, WORK_ORDER_PRIORITY_LABELS_TH);
}

export function getMachineTypeLabelTh(value?: string | null): string {
  return getLabelTh(value, MACHINE_TYPE_LABELS_TH);
}

export function getMachineStatusLabelTh(value?: string | null): string {
  return getLabelTh(value, MACHINE_STATUS_LABELS_TH);
}

export function getConsumableCategoryLabelTh(value?: string | null): string {
  return getLabelTh(value, CONSUMABLE_CATEGORY_LABELS_TH);
}

export function getPurchaseOrderLineTypeLabelTh(value?: string | null): string {
  return getLabelTh(value, PURCHASE_ORDER_LINE_TYPE_LABELS_TH);
}

export function getFinanceStatusLabelTh(value?: string | null): string {
  return getLabelTh(value, FINANCE_STATUS_LABELS_TH);
}

export function getPaymentMethodLabelTh(value?: string | null): string {
  return getLabelTh(value, PAYMENT_METHOD_LABELS_TH);
}

export function getCustomerTypeLabelTh(value?: string | null): string {
  return getLabelTh(value, CUSTOMER_TYPE_LABELS_TH);
}

export function getQuotationStatusLabelTh(value?: string | null): string {
  return getLabelTh(value, QUOTATION_STATUS_LABELS_TH);
}

export function getSalesOrderStatusLabelTh(value?: string | null): string {
  return getLabelTh(value, SALES_ORDER_STATUS_LABELS_TH);
}

export function getVatRegistrationLabelTh(value?: string | boolean | null): string {
  if (value == null || value === "") return "";
  if (value === true || value === "true") return "จดทะเบียน VAT แล้ว";
  if (value === false || value === "false") return "ยังไม่จดทะเบียน VAT";
  return String(value);
}

export function getMaterialReadinessLabelTh(value?: string | null): string {
  return getLabelTh(value, MATERIAL_READINESS_LABELS_TH);
}

export function getMaintenanceTypeLabelTh(value?: string | null): string {
  return getLabelTh(value, MAINTENANCE_TYPE_LABELS_TH);
}

export function getInvoiceTypeLabelTh(value?: string | null): string {
  return getLabelTh(value, INVOICE_TYPE_LABELS_TH);
}

export function getWhtCertStatusLabelTh(value?: string | null): string {
  return getLabelTh(value, WHT_CERT_STATUS_LABELS_TH);
}

export function getAllOptionLabelTh(value?: string | null): string {
  return value == null || value === "" || value === "ALL" ? "ทั้งหมด" : value;
}
