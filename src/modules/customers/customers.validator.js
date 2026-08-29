import { z } from 'zod';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;
const objectIdSchema = z.string().regex(objectIdRegex, 'Invalid ObjectId format');

export const idParamSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
});

export const updateMeSchema = z.object({
  body: z.object({
    name: z.string().min(1).optional(),
    profileImage: z.string().optional(),
    phone: z.string().min(1).optional(),
  }),
});

export const updateStatusSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
  body: z.object({
    status: z.enum(['active', 'disabled', 'suspended']),
  }),
});
