import { z } from 'zod';

export const CreateBomLineSchema = z.object({
  component_id: z.string().uuid(),
  uom_id: z.string().uuid(),
  qty_required: z.number().positive(),
  scrap_pct: z.number().min(0).max(99.99).default(0),
  notes: z.string().optional().nullable(),
});

export const CreateBomSchema = z.object({
  product_id: z.string().uuid(),
  uom_id: z.string().uuid(),
  output_qty: z.number().positive().default(1),
  bom_type: z.enum(['manufacturing', 'kit']).default('manufacturing'),
  version: z.number().int().positive().default(1),
  notes: z.string().optional().nullable(),
  lines: z.array(CreateBomLineSchema).min(1),
});

export const PatchBomSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('update_header'),
    output_qty: z.number().positive().optional(),
    notes: z.string().optional().nullable(),
  }),
  z.object({
    action: z.literal('activate'),
  }),
  z.object({
    action: z.literal('deactivate'),
  }),
  z.object({
    action: z.literal('add_line'),
    line: CreateBomLineSchema,
  }),
  z.object({
    action: z.literal('update_line'),
    line_id: z.string().uuid(),
    qty_required: z.number().positive().optional(),
    scrap_pct: z.number().min(0).max(99.99).optional(),
    notes: z.string().optional().nullable(),
  }),
  z.object({
    action: z.literal('remove_line'),
    line_id: z.string().uuid(),
  }),
]);

export const CreateProductUomSchema = z.object({
  uom_id: z.string().uuid(),
  conversion_factor: z.number().positive(),
  uom_type: z.enum(['purchase', 'sales', 'other']).default('other'),
});

export const PatchProductUomSchema = z.object({
  conversion_factor: z.number().positive().optional(),
  uom_type: z.enum(['purchase', 'sales', 'other']).optional(),
  is_active: z.boolean().optional(),
});
