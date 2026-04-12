import { z } from "zod";

export const productCreateSchema = z.object({
  code: z.string().min(1, "Required"),
  name: z.string().min(1, "Required"),
  description: z.string().optional(),
  category: z.string().optional(),
  fusionFileName: z.string().optional(),
  fusionFileUrl: z.string().url().optional().or(z.literal("")),
  drawingNotes: z.string().optional(),
  requiresPainting: z.boolean(),
  requiresLogoEngraving: z.boolean(),
  defaultColor: z.string().optional(),
  defaultSurfaceFinish: z.string().optional(),
  unitPrice: z.number().min(0).optional(),
  cycleTimeMinutes: z.number().min(0).optional(),
  leadTimeDays: z.number().int().min(0),
});

export const productUpdateSchema = productCreateSchema.partial().omit({ code: true });

export const bomLineSchema = z.object({
  materialId: z.string().min(1, "Required"),
  qtyPerUnit: z.number().positive("Must be > 0"),
  materialSize: z.string().optional(),
  materialType: z.string().optional(),
  piecesPerStock: z.number().int().min(1).optional(),
  notes: z.string().optional(),
  sortOrder: z.number().int(),
});

export type ProductCreateInput = z.infer<typeof productCreateSchema>;
export type ProductUpdateInput = z.infer<typeof productUpdateSchema>;
export type BomLineInput = z.infer<typeof bomLineSchema>;
