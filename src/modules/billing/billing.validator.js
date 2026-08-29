import { z } from 'zod';

export const getBillingSchema = z.object({
  params: z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ID format'),
  }),
});

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const posPreviewSchema = z.object({
  body: z.object({
    items: z.array(
      z.object({
        productId: z.string().regex(objectIdRegex, 'Invalid product ID format'),
        quantity: z.number().int().min(1, 'Quantity must be at least 1'),
      })
    ).min(1, 'Billing must contain at least 1 item'),
    discountAmount: z.number().nonnegative().optional(),
    paymentAllocations: z.array(
      z.object({
        method: z.string().min(1, 'Payment method is required'),
        amount: z.number().nonnegative('Allocation amount must be non-negative'),
      })
    ).optional(),
  }),
});

export const posCheckoutSchema = z.object({
  body: z.object({
    items: z.array(
      z.object({
        productId: z.string().regex(objectIdRegex, 'Invalid product ID format'),
        quantity: z.number().int().min(1, 'Quantity must be at least 1'),
      })
    ).min(1, 'Billing must contain at least 1 item'),
    discountAmount: z.number().nonnegative().optional(),
    paymentAllocations: z.array(
      z.object({
        method: z.string().min(1, 'Payment method is required'),
        amount: z.number().nonnegative('Allocation amount must be non-negative'),
      })
    ).min(1, 'Payment allocation is required'),
    customerName: z.string().optional(),
    customerPhone: z.string().optional(),
    notes: z.string().optional(),
  }),
});
