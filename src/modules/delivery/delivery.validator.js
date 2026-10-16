import { z } from 'zod';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;
const objectIdSchema = z.string().regex(objectIdRegex, 'Invalid ObjectId format');

export const deliveryStatusUpdateSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
  body: z.object({
    status: z.enum([
      'processing',
      'in_transit',
      'out_for_delivery',
      'delivered',
      'delivery_later',
      'cancelled',
    ]),
    notes: z.string().max(500).optional().default(''),
    rescheduledDate: z.string().optional(),
  }),
});

export const collectPaymentSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
  body: z.object({
    paymentMethod: z.string().optional().default('Cash on Delivery'),
    transactionReference: z.string().max(100).optional().default(''),
    notes: z.string().max(500).optional().default(''),
  }).optional().default({}),
});

export const deliveryFilterSchema = z.object({
  query: z.object({
    period: z.enum(['daily', 'weekly', 'monthly', 'custom']).optional().default('daily'),
    date: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    status: z.string().optional(),
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  }).optional().default({}),
});

export const deliveryIdParamSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
});
