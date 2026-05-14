import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();
const formSource = readFileSync(
  join(repoRoot, "src/app/[locale]/(main)/production/products/product-form.tsx"),
  "utf8",
);
const listSource = readFileSync(
  join(repoRoot, "src/app/[locale]/(main)/production/products/product-list-client.tsx"),
  "utf8",
);
const detailSource = readFileSync(
  join(repoRoot, "src/app/[locale]/(main)/production/products/[id]/product-detail-client.tsx"),
  "utf8",
);
const editPageSource = readFileSync(
  join(repoRoot, "src/app/[locale]/(main)/production/products/[id]/edit/page.tsx"),
  "utf8",
);
const factoryBoardSource = readFileSync(
  join(repoRoot, "src/app/[locale]/factory/factory-board.tsx"),
  "utf8",
);
const factoryBoardApiSource = readFileSync(
  join(repoRoot, "src/app/api/public/factory-board/route.ts"),
  "utf8",
);
const adminExportSource = readFileSync(
  join(repoRoot, "src/app/api/admin/export/[entity]/route.ts"),
  "utf8",
);
const finishingNotesMigration = readFileSync(
  join(
    repoRoot,
    "prisma/migrations/20260514175238_product_finishing_notes/migration.sql",
  ),
  "utf8",
);

describe("product master billing/drawing UI contracts", () => {
  it("makes product kind a required source-of-truth field on the product form", () => {
    expect(formSource).toContain('productKind: "GOODS"');
    expect(formSource).toContain('watch("productKind")');
    expect(formSource).toContain('setValue("productKind"');
    expect(formSource).toContain("ประเภท *");
    expect(formSource).toContain('<SelectItem value="GOODS">สินค้า</SelectItem>');
    expect(formSource).toContain('<SelectItem value="SERVICE">บริการ</SelectItem>');
  });

  it("captures product-level drawing metadata without billing auto-classification wording", () => {
    expect(formSource).toContain("ข้อมูลแบบงานของสินค้า/บริการ");
    expect(formSource).toContain('watch("drawingSource")');
    expect(formSource).toContain('setValue("drawingSource"');
    expect(formSource).toContain('<SelectItem value="TENANT_OWNED">แบบเรา</SelectItem>');
    expect(formSource).toContain('<SelectItem value="CUSTOMER_PROVIDED">แบบลูกค้า</SelectItem>');
    expect(formSource).toContain('<SelectItem value="JOINT_DEVELOPMENT">ร่วมพัฒนา</SelectItem>');
    expect(formSource).toContain("Drawing Rev");
    expect(formSource).toContain('register("drawingRevision")');
    expect(formSource).toContain("ไฟล์แบบจากลูกค้า (URL)");
    expect(formSource).toContain('register("customerDrawingUrl")');
    expect(formSource).toContain("ข้อมูลที่มาของแบบเป็น metadata");
    expect(formSource).toContain('register("fusionFileName")');
    expect(formSource).toContain('register("fusionFileUrl")');
    expect(formSource).toContain('register("drawingNotes")');

    for (const source of [formSource, detailSource]) {
      expect(source).not.toMatch(/auto-?classif/i);
      expect(source).not.toMatch(/auto-?suggest billing nature/i);
      expect(source).not.toMatch(/billing nature/i);
    }
  });

  it("shows product kind on product list and detail screens", () => {
    for (const source of [listSource, detailSource]) {
      expect(source).toContain("productKind");
      expect(source).toContain("สินค้า");
      expect(source).toContain("บริการ");
    }
  });

  it("shows drawing metadata on the product detail screen", () => {
    expect(detailSource).toContain("ข้อมูลแบบงานของสินค้า/บริการ");
    expect(detailSource).toContain("drawingSource");
    expect(detailSource).toContain("drawingRevision");
    expect(detailSource).toContain("customerDrawingUrl");
    expect(detailSource).toContain("แบบเรา");
    expect(detailSource).toContain("แบบลูกค้า");
    expect(detailSource).toContain("ร่วมพัฒนา");
  });

  it("preserves product kind and drawing metadata while editing products", () => {
    expect(editPageSource).toContain("productKind: serialized.productKind");
    expect(editPageSource).toContain("drawingSource: serialized.drawingSource");
    expect(editPageSource).toContain("drawingRevision: serialized.drawingRevision");
    expect(editPageSource).toContain("customerDrawingUrl: serialized.customerDrawingUrl");
  });

  it("uses checkboxes for manufacturing flags and one combined finishing notes field", () => {
    expect(formSource).toContain('type="checkbox" {...register("requiresPainting")}');
    expect(formSource).toContain('type="checkbox" {...register("requiresLogoEngraving")}');
    expect(formSource).toContain('register("finishingNotes")');
    expect(formSource).toContain("หมายเหตุสี/ผิวสำเร็จ");
    expect(formSource).toContain("ลูกค้าสั่งหลายสี");
    expect(formSource).not.toContain('register("defaultColor")');
    expect(formSource).not.toContain('register("defaultSurfaceFinish")');
    expect(formSource).not.toContain("สีเริ่มต้น");
    expect(formSource).not.toContain("ผิวสำเร็จเริ่มต้น");

    expect(detailSource).toContain("finishingNotes");
    expect(detailSource).not.toContain("defaultColor &&");
    expect(detailSource).not.toContain("defaultSurfaceFinish &&");
    expect(editPageSource).toContain("finishingNotes: serialized.finishingNotes");
  });

  it("carries combined finishing notes into factory board and product export surfaces", () => {
    expect(factoryBoardApiSource).toContain("finishingNotes: true");
    expect(factoryBoardApiSource).not.toContain("defaultColor: true");
    expect(factoryBoardApiSource).not.toContain("defaultSurfaceFinish: true");

    expect(factoryBoardSource).toContain("finishingNotes: string | null");
    expect(factoryBoardSource).toContain("selectedWO.product.finishingNotes");
    expect(factoryBoardSource).toContain("หมายเหตุสี/ผิวสำเร็จ");
    expect(factoryBoardSource).not.toContain("selectedWO.product.defaultColor");
    expect(factoryBoardSource).not.toContain("selectedWO.product.defaultSurfaceFinish");

    expect(adminExportSource).toContain("finishingNotes: true");
    expect(adminExportSource).not.toContain("defaultColor: true");
  });

  it("backfills legacy color and surface finish into combined notes during migration", () => {
    expect(finishingNotesMigration).toContain('ADD COLUMN "finishingNotes" TEXT');
    expect(finishingNotesMigration).toContain('"defaultColor"');
    expect(finishingNotesMigration).toContain('"defaultSurfaceFinish"');
    expect(finishingNotesMigration).toContain('SET "finishingNotes"');
    expect(finishingNotesMigration).toContain("สีเดิม:");
    expect(finishingNotesMigration).toContain("ผิวสำเร็จเดิม:");
  });
});
