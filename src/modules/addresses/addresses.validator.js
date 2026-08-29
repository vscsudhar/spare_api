import { z } from 'zod';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;
const objectIdSchema = z.string().regex(objectIdRegex, 'Invalid ObjectId format');

export const idParamSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
});

export const createAddressSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Label name is required').trim(),
    recipientName: z.string().min(1, 'Recipient name is required').trim(),
    phone: z.string().min(1, 'Phone number is required').trim(),
    addressLine1: z.string().min(1, 'Address line 1 is required').trim(),
    addressLine2: z.string().optional(),
    city: z.string().min(1, 'City is required').trim(),
    state: z.string().min(1, 'State is required').trim(),
    postalCode: z.string().min(1, 'Postal code is required').trim(),
    country: z.string().optional().default('India'),
    isDefault: z.boolean().optional().default(false),
  }),
});

export const updateAddressSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
  body: z.object({
    name: z.string().min(1).optional(),
    recipientName: z.string().min(1).optional(),
    phone: z.string().min(1).optional(),
    addressLine1: z.string().min(1).optional(),
    addressLine2: z.string().optional(),
    city: z.string().min(1).optional(),
    state: z.string().min(1).optional(),
    postalCode: z.string().min(1).optional(),
    country: z.string().optional(),
    isDefault: z.boolean().optional(),
  }),
});
