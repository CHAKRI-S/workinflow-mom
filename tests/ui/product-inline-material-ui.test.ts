import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();
const productFormSource = readFileSync(
  join(repoRoot, "src/app/[locale]/(main)/production/products/product-form.tsx"),
  "utf8",
);
const editPageSource = readFileSync(
  join(repoRoot, "src/app/[locale]/(main)/production/products/[id]/edit/page.tsx"),
  "utf8",
);

describe("product form inline material UX contract", () => {
  it("lets each BOM line switch between existing material and inline new material", () => {
    expect(productFormSource).toContain('type BomMaterialMode = "EXISTING" | "NEW"');
    expect(productFormSource).toContain('mode: "EXISTING"');
    expect(productFormSource).toContain('SelectItem value="EXISTING"');
    expect(productFormSource).toContain('ใช้วัตถุดิบที่มีอยู่');
    expect(productFormSource).toContain('SelectItem value="NEW"');
    expect(productFormSource).toContain('สร้างวัตถุดิบใหม่');
    expect(productFormSource).toContain('line.mode === "EXISTING"');
    expect(productFormSource).toContain('line.mode === "NEW"');
  });

  it("shows Thai sourcing labels and defaults BOM lines to stock-cut sourcing", () => {
    expect(productFormSource).toContain('type BomMaterialSourcing = "STOCK_CUT" | "JOB_SPECIFIC"');
    expect(productFormSource).toContain('sourcing: "STOCK_CUT"');
    expect(productFormSource).toContain('SelectItem value="STOCK_CUT"');
    expect(productFormSource).toContain('สต๊อกแล้วแบ่งตัด');
    expect(productFormSource).toContain('SelectItem value="JOB_SPECIFIC"');
    expect(productFormSource).toContain('สั่งเฉพาะงาน/สินค้านี้');
  });

  it("renders inline material fields without an editable code field and includes auto-code helper copy", () => {
    expect(productFormSource).toContain('newMaterial: createEmptyNewMaterial()');
    expect(productFormSource).toContain('updateNewMaterial(idx, "name"');
    expect(productFormSource).toContain('updateNewMaterial(idx, "type"');
    expect(productFormSource).toContain('updateNewMaterial(idx, "specification"');
    expect(productFormSource).toContain('updateNewMaterial(idx, "unit"');
    expect(productFormSource).toContain('updateNewMaterial(idx, "dimensions"');
    expect(productFormSource).toContain('updateNewMaterial(idx, "minStockQty"');
    expect(productFormSource).toContain('updateNewMaterial(idx, "unitCost"');
    expect(productFormSource).toContain('ระบบจะสร้างรหัสวัตถุดิบให้อัตโนมัติ');
    expect(productFormSource).toContain('WF01-MAT-0001');
    expect(productFormSource).not.toContain('newMaterial.code');
    expect(productFormSource).not.toContain('updateNewMaterial(idx, "code"');
  });

  it("validates required inline material names before saving the product", () => {
    expect(productFormSource).toContain('export function getBomLineValidationError');
    expect(productFormSource).toContain('กรุณากรอกชื่อวัตถุดิบใหม่ใน BOM');
    expect(productFormSource).toContain('const bomLineValidationError = getBomLineValidationError(bomLines);');
    expect(productFormSource.indexOf('const bomLineValidationError = getBomLineValidationError(bomLines);')).toBeLessThan(
      productFormSource.indexOf('const res = await fetch(url'),
    );
    expect(productFormSource).toContain('setError(bomLineValidationError);');
    expect(productFormSource).toContain('return;');
  });

  it("builds BOM API payload lines with exactly materialId or newMaterial plus sourcing", () => {
    expect(productFormSource).toContain('export function buildBomLinePayload');
    expect(productFormSource).toContain('const validLines = buildBomLinePayload(bomLines);');
    expect(productFormSource).toContain('materialId: line.materialId');
    expect(productFormSource).toContain('newMaterial: sanitizeNewMaterial(line.newMaterial)');
    expect(productFormSource).toContain('sourcing: line.sourcing ?? "STOCK_CUT"');
    expect(productFormSource).not.toContain('materialId: line.materialId,\n      newMaterial');
  });

  it("maps edited products to existing-material mode while preserving saved sourcing", () => {
    expect(productFormSource).toContain('mode: "EXISTING"');
    expect(productFormSource).toContain('sourcing: l.sourcing ?? "STOCK_CUT"');
    expect(editPageSource).toContain('existingBomLines={serialized.bomLines}');
  });
});
