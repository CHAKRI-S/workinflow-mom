import { z } from "zod";
import { VAT_PRICE_MODES } from "@/lib/vat";
import { drawingSourceEnum } from "@/lib/validators/billing-nature";

export const productKindEnum = z.enum(["GOODS", "SERVICE"]);

const productBaseSchema = z.object({
  // Optional on create — normal create flows generate code server-side.
  code: z.string().optional(),
  name: z.string().min(1, "Required"),
  description: z.string().optional(),
  category: z.string().optional(),
  productKind: productKindEnum.optional(),
  drawingSource: drawingSourceEnum.optional(),
  drawingRevision: z.string().optional(),
  customerDrawingUrl: z.string().url().optional().or(z.literal("")),
  fusionFileName: z.string().optional(),
  fusionFileUrl: z.string().url().optional().or(z.literal("")),
  drawingNotes: z.string().optional(),
  requiresPainting: z.boolean(),
  requiresLogoEngraving: z.boolean(),
  finishingNotes: z.string().optional(),
  unitPrice: z.number().min(0).optional(),
  defaultVatPriceMode: z.enum(VAT_PRICE_MODES).optional(),
  cycleTimeMinutes: z.number().min(0).optional(),
  leadTimeDays: z.number().int().min(0),
});

export const productCreateSchema = productBaseSchema.extend({
  productKind: productKindEnum.optional().default("GOODS"),
  drawingSource: drawingSourceEnum.optional().default("TENANT_OWNED"),
  defaultVatPriceMode: z.enum(VAT_PRICE_MODES).optional().default("EXCLUSIVE"),
});

export const productUpdateSchema = productBaseSchema.partial().omit({ code: true });

export const bomMaterialSourcingEnum = z.enum(["STOCK_CUT", "JOB_SPECIFIC"]);

export const bomNewMaterialSchema = z.object({
  name: z.string().min(1, "Required"),
  type: z.string().optional(),
  specification: z.string().optional(),
  unit: z
    .enum(["PCS", "KG", "M", "MM", "CM", "SHEET", "BAR", "ROD", "BLOCK", "SET", "BOX"])
    .optional()
    .default("PCS"),
  dimensions: z.string().optional(),
  minStockQty: z.number().min(0).optional().default(0),
  unitCost: z.number().min(0).optional(),
}).strict();

export const bomLineSchema = z
  .object({
    materialId: z.string().min(1, "Required").optional(),
    newMaterial: bomNewMaterialSchema.optional(),
    qtyPerUnit: z.number().positive("Must be > 0"),
    materialSize: z.string().optional(),
    materialType: z.string().optional(),
    piecesPerStock: z.number().int().min(1).optional(),
    notes: z.string().optional(),
    sourcing: bomMaterialSourcingEnum.optional().default("STOCK_CUT"),
    sortOrder: z.number().int().optional(),
  })
  .refine((line) => Boolean(line.materialId) !== Boolean(line.newMaterial), {
    message: "Choose either materialId or newMaterial",
    path: ["materialId"],
  });

export type ProductCreateInput = z.input<typeof productCreateSchema>;
export type ProductUpdateInput = z.input<typeof productUpdateSchema>;
export type BomLineInput = z.input<typeof bomLineSchema>;
