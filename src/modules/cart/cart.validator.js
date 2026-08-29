import { z } from 'zod';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;
const objectIdSchema = z.string().regex(objectIdRegex, 'Invalid ObjectId format');

export const itemIdParamSchema = z.object({
  params: z.object({
    itemId: objectIdSchema,
  }),
});

export const addItemSchema = z.object({
  body: z.object({
    productId: objectIdSchema,
    quantity: z.number().int().min(1, 'Quantity must be at least 1').optional().default(1),
    variantId: objectIdSchema.optional(),
  }),
});

export const updateItemSchema = z.object({
  params: z.object({
    itemId: objectIdSchema,
  }),
  body: z.object({
    quantity: z.number().int().min(1, 'Quantity must be at least 1'),
  }),
});

export const applyCouponSchema = z.object({
  body: z.object({
    code: z.string().min(1, 'Coupon code is required').trim().toUpperCase(),
  }),
});
