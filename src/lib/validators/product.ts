import { z } from "zod";
import { VAT_PRICE_MODES } from "@/lib/vat";
import { drawingSourceEnum } from "@/lib/validators/billing-nature";

export const productKindEnum = z.enum(["GOODS", "SERVICE"]);

const productBaseSchema = z.object({
  code: z.string().min(1, "Required"),
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
  defaultColor: z.string().optional(),
  defaultSurfaceFinish: z.string().optional(),
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

export const bomLineSchema = z.object({
  materialId: z.string().min(1, "Required"),
  qtyPerUnit: z.number().positive("Must be > 0"),
  materialSize: z.string().optional(),
  materialType: z.string().optional(),
  piecesPerStock: z.number().int().min(1).optional(),
  notes: z.string().optional(),
  sortOrder: z.number().int(),
});

export type ProductCreateInput = z.input<typeof productCreateSchema>;
export type ProductUpdateInput = z.input<typeof productUpdateSchema>;
export type BomLineInput = z.input<typeof bomLineSchema>;
