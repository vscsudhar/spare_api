import { z } from 'zod';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;
const objectIdSchema = z.string().regex(objectIdRegex, 'Invalid ObjectId format');

export const idParamSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
});

const poItemSchema = z.object({
  product: objectIdSchema,
  quantity: z.number().int().min(1, 'Quantity must be at least 1'),
  unitPrice: z.number().min(0, 'Unit price cannot be negative'),
  taxPercentage: z.number().min(0).max(100).optional().default(18),
});

export const createPurchaseOrderSchema = z.object({
  body: z.object({
    supplier: objectIdSchema,
    items: z.array(poItemSchema).min(1, 'Purchase order must have at least one item'),
    notes: z.string().optional(),
    expectedDeliveryDate: z.string().optional(),
  }),
});

export const updatePurchaseOrderSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
  body: z.object({
    supplier: objectIdSchema.optional(),
    items: z.array(poItemSchema).optional(),
    notes: z.string().optional(),
    expectedDeliveryDate: z.string().optional(),
  }),
});

export const updatePOStatusSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
  body: z.object({
    status: z.enum([
      'draft',
      'submitted',
      'approved',
      'ordered',
      'partially_received',
      'received',
      'cancelled',
    ]),
  }),
});

const receiptItemSchema = z.object({
  product: objectIdSchema,
  quantityReceived: z.number().int().min(1, 'Quantity received must be at least 1'),
});

export const receiveReceiptSchema = z.object({
  params: z.object({
    id: objectIdSchema, // PO ID
  }),
  body: z.object({
    items: z.array(receiptItemSchema).min(1, 'Must receive at least one item'),
  }),
});

export const createPOPaymentSchema = z.object({
  params: z.object({
    id: objectIdSchema, // PO ID
  }),
  body: z.object({
    amount: z.number().min(0.01, 'Payment amount must be greater than zero'),
    paymentMethod: z.enum(['bank_transfer', 'upi', 'cash', 'cheque']),
    transactionReference: z.string().optional(),
    notes: z.string().optional(),
    expectedDeliveryDate: z.string().optional(),
  }),
});
