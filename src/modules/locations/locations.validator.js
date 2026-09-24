import { z } from 'zod';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;
const objectIdSchema = z.string().regex(objectIdRegex, 'Invalid ObjectId format');

export const idParamSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
});

export const locationInventoryParamSchema = z.object({
  params: z.object({
    locationId: objectIdSchema,
    productId: objectIdSchema.optional(),
  }),
});

export const updateInventoryStockSchema = z.object({
  params: z.object({
    locationId: objectIdSchema,
    productId: objectIdSchema,
  }),
  body: z.object({
    quantity: z.coerce
      .number({ invalid_type_error: 'Quantity must be a number' })
      .min(0, 'Quantity cannot be negative'),
  }),
});

export const createLocationSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Location name is required').trim(),
    latitude: z
      .number({ invalid_type_error: 'Latitude must be a valid decimal number' })
      .min(-90, 'Latitude must be between -90 and 90')
      .max(90, 'Latitude must be between -90 and 90'),
    longitude: z
      .number({ invalid_type_error: 'Longitude must be a valid decimal number' })
      .min(-180, 'Longitude must be between -180 and 180')
      .max(180, 'Longitude must be between -180 and 180'),
    radiusKm: z
      .number({ invalid_type_error: 'Radius must be a number' })
      .positive('Radius must be greater than 0')
      .optional()
      .default(20),
    isActive: z.boolean().optional().default(true),
  }),
});

export const updateLocationSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
  body: z.object({
    name: z.string().min(1, 'Location name cannot be empty').trim().optional(),
    latitude: z
      .number({ invalid_type_error: 'Latitude must be a valid decimal number' })
      .min(-90, 'Latitude must be between -90 and 90')
      .max(90, 'Latitude must be between -90 and 90')
      .optional(),
    longitude: z
      .number({ invalid_type_error: 'Longitude must be a valid decimal number' })
      .min(-180, 'Longitude must be between -180 and 180')
      .max(180, 'Longitude must be between -180 and 180')
      .optional(),
    radiusKm: z
      .number({ invalid_type_error: 'Radius must be a number' })
      .positive('Radius must be greater than 0')
      .optional(),
    isActive: z.boolean().optional(),
  }),
});
