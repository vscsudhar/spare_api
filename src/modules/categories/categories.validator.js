import { z } from 'zod';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;
const objectIdSchema = z.string().regex(objectIdRegex, 'Invalid ObjectId format');

export const idParamSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
});

export const createCategorySchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Category name is required').trim(),
    description: z.string().optional(),
    parentCategory: objectIdSchema.nullable().optional(),
    type: z.enum(['EV', 'Petrol', 'Universal']).optional().default('Universal'),
    active: z.boolean().optional().default(true),
  }),
});

export const updateCategorySchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
  body: z.object({
    name: z.string().min(1).optional(),
    description: z.string().optional(),
    parentCategory: objectIdSchema.nullable().optional(),
    type: z.enum(['EV', 'Petrol', 'Universal']).optional(),
    active: z.boolean().optional(),
  }),
});
