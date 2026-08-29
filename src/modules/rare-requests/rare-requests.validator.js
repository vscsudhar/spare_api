import { z } from 'zod';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;
const objectIdSchema = z.string().regex(objectIdRegex, 'Invalid ObjectId format');

export const idParamSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
});

export const idAndQuotationIdParamSchema = z.object({
  params: z.object({
    id: objectIdSchema,
    quotationId: objectIdSchema,
  }),
});

export const createRequestSchema = z.object({
  body: z.object({
    title: z.string().min(1, 'Title is required').trim(),
    description: z.string().min(1, 'Description is required').trim(),
    vehicleType: z.enum(['EV', 'Petrol', 'Universal']),
    vehicleBrand: z.string().min(1, 'Vehicle brand is required').trim(),
    vehicleModel: z.string().min(1, 'Vehicle model is required').trim(),
    vehicleYear: z.number().int().min(1900).max(new Date().getFullYear() + 2),
    partNumber: z.string().optional().default(''),
  }),
});

export const updateRequestSchema = z.object({
  body: z.object({
    title: z.string().min(1).optional(),
    description: z.string().min(1).optional(),
    vehicleType: z.enum(['EV', 'Petrol', 'Universal']).optional(),
    vehicleBrand: z.string().min(1).optional(),
    vehicleModel: z.string().min(1).optional(),
    vehicleYear: z.number().int().min(1900).max(new Date().getFullYear() + 2).optional(),
    partNumber: z.string().optional(),
  }),
});

export const createMessageSchema = z.object({
  body: z.object({
    message: z.string().min(1, 'Message text is required').trim(),
  }),
});

const quotationItemSchema = z.object({
  name: z.string().min(1, 'Item name is required').trim(),
  partNumber: z.string().optional().default(''),
  quantity: z.number().int().min(1, 'Quantity must be at least 1'),
  unitPrice: z.number().int().min(0, 'Unit price cannot be negative'), // paise
  taxPercentage: z.number().min(0).max(100).optional().default(18),
});

export const createQuotationSchema = z.object({
  body: z.object({
    expiresAt: z.string().datetime('Invalid ISO datetime string'),
    deliveryFee: z.number().int().min(0, 'Delivery fee cannot be negative').optional().default(0), // paise
    items: z.array(quotationItemSchema).min(1, 'Quotation must contain at least 1 item'),
  }),
});

export const updateQuotationSchema = z.object({
  body: z.object({
    expiresAt: z.string().datetime('Invalid ISO datetime string').optional(),
    deliveryFee: z.number().int().min(0, 'Delivery fee cannot be negative').optional(), // paise
    items: z.array(quotationItemSchema).min(1).optional(),
  }),
});

export const updateStatusSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
  body: z.object({
    status: z.enum([
      'submitted',
      'searching',
      'found',
      'quotation_sent',
      'negotiation',
      'approved',
      'cancelled',
      'converted_to_order',
    ]),
    notes: z.string().optional().default(''),
  }),
});

export const cancelRequestSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
  body: z.object({
    reason: z.string().min(1, 'Reason for cancellation is required').trim(),
  }),
});
