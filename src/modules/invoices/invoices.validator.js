import { z } from 'zod';

export const idParamSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'ID parameter is required'),
  }),
});

export const orderInvoiceParamSchema = z.object({
  params: z.object({
    orderId: z.string().optional(),
    id: z.string().optional(),
  }),
});
