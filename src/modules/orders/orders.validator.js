import { z } from 'zod';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;
const objectIdSchema = z.string().regex(objectIdRegex, 'Invalid ObjectId format');

export const idParamSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
});

export const createOrderSchema = z.object({
  body: z.object({
    addressId: objectIdSchema,
    idempotencyKey: z.string().optional(),
  }),
});

export const adminUpdateStatusSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
  body: z.object({
    status: z.enum([
      'pending',
      'confirmed',
      'processing',
      'packed',
      'shipped',
      'out_for_delivery',
      'delivered',
      'cancelled',
      'returned',
    ]),
    notes: z.string().optional(),
  }),
});

export const adminAssignDeliverySchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
  body: z.object({
    driverId: objectIdSchema,
    notes: z.string().optional(),
  }),
});

export const adminAddNoteSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
  body: z.object({
    text: z.string().min(1, 'Note content cannot be empty').trim(),
  }),
});
