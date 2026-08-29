import { z } from 'zod';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;
const objectIdSchema = z.string().regex(objectIdRegex, 'Invalid ObjectId format');

export const productIdParamSchema = z.object({
  params: z.object({
    productId: objectIdSchema,
  }),
});
