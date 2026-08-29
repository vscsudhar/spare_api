import { z } from 'zod';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;
const objectIdSchema = z.string().regex(objectIdRegex, 'Invalid ObjectId format');

export const createAdjustmentSchema = z.object({
  body: z.object({
    productId: objectIdSchema,
    quantity: z.number().refine((val) => val !== 0, {
      message: 'Quantity cannot be zero',
    }),
    reason: z.string().min(1, 'Reason for adjustment is required').trim(),
  }),
});

export const productIdParamSchema = z.object({
  params: z.object({
    productId: objectIdSchema,
  }),
});
