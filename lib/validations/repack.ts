import { z } from 'zod';

export const RepackTemplateItemSchema = z.object({
  product_id: z.string().uuid(),
  qty_ratio: z.number().positive(),
  notes: z.string().nullable().optional(),
});

export const CreateRepackTemplateSchema = z.object({
  name: z.string().min(1, 'Template name is required'),
  source_product_id: z.string().uuid(),
  source_qty: z.number().positive(),
  notes: z.string().nullable().optional(),
  items: z.array(RepackTemplateItemSchema).min(1, 'At least one output item is required'),
});

export const RepackOrderItemSchema = z.object({
  product_id: z.string().uuid(),
  qty: z.number().positive(),
  unit_cost: z.number().nonnegative(),
  notes: z.string().nullable().optional(),
});

export const CreateRepackOrderSchema = z.object({
  source_product_id: z.string().uuid(),
  source_qty: z.number().positive(),
  warehouse_id: z.string().uuid(),
  notes: z.string().nullable().optional(),
  items: z.array(RepackOrderItemSchema).min(1, 'At least one output item is required'),
});

export const PatchRepackOrderSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('complete'),
  }),
  z.object({
    action: z.literal('void'),
    reason: z.string().min(1, 'Void reason is required'),
  }),
  z.object({
    action: z.literal('update'),
    data: CreateRepackOrderSchema.partial(),
  }),
]);
