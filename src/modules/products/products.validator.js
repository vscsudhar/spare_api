import { z } from 'zod';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;
const objectIdSchema = z.string().regex(objectIdRegex, 'Invalid ObjectId format');

export const idParamSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
});

export const imageIdParamSchema = z.object({
  params: z.object({
    id: objectIdSchema,
    imageId: objectIdSchema,
  }),
});

const compatibilitySchema = z.object({
  brand: objectIdSchema,
  model: objectIdSchema,
  years: z.array(z.string()).optional().default([]),
});

const variantSchema = z.object({
  sku: z.string().min(1),
  name: z.string().min(1),
  price: z.number().min(0),
  stock: z.number().min(0).optional().default(0),
});

export const createProductSchema = z.object({
  body: z.object({
    sku: z.string().min(1, 'SKU is required').trim(),
    name: z.string().min(1, 'Product name is required').trim(),
    description: z.string().optional(),
    brand: z.string().optional().default('Generic'),
    fitType: z.enum(['vehicle_specific', 'universal']).optional().default('vehicle_specific'),
    stockManaged: z.boolean().optional().default(true),
    compatibleVehicles: z.array(compatibilitySchema).optional(),
    category: objectIdSchema,
    vehicleType: objectIdSchema.optional(),
    compatibilities: z.array(compatibilitySchema).optional(),
    oemPartNumbers: z.array(z.string()).optional().default([]),
    images: z.array(z.object({
      url: z.string().min(1, 'Image URL/Path is required'),
      isDefault: z.boolean().optional().default(false),
    })).optional().default([]),
    sellingPrice: z.number().min(0, 'Selling price must be non-negative'),
    mrp: z.number().min(0, 'MRP must be non-negative'),
    purchasePrice: z.number().min(0, 'Purchase price must be non-negative'),
    taxPercentage: z.number().min(0).max(100).optional().default(18),
    currentStock: z.number().min(0).optional().default(0),
    unit: z.string().optional().default('pcs'),
    variants: z.array(variantSchema).optional().default([]),
    featured: z.boolean().optional().default(false),
    fastMoving: z.boolean().optional().default(false),
    active: z.boolean().optional().default(true),
    searchKeywords: z.array(z.string()).optional().default([]),
    minimumStock: z.number().min(0).optional().default(0),
    locationBin: z.string().optional(),
    warranty: z.string().optional(),
    returnEligibility: z.boolean().optional().default(true),
  }),
});

export const updateProductSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
  body: z.object({
    sku: z.string().min(1).optional(),
    name: z.string().min(1).optional(),
    description: z.string().optional(),
    brand: z.string().optional(),
    fitType: z.enum(['vehicle_specific', 'universal']).optional(),
    stockManaged: z.boolean().optional(),
    compatibleVehicles: z.array(compatibilitySchema).optional(),
    category: objectIdSchema.optional(),
    vehicleType: objectIdSchema.optional(),
    compatibilities: z.array(compatibilitySchema).optional(),
    oemPartNumbers: z.array(z.string()).optional(),
    images: z.array(z.object({
      url: z.string().min(1),
      isDefault: z.boolean().optional().default(false),
    })).optional(),
    sellingPrice: z.number().min(0).optional(),
    mrp: z.number().min(0).optional(),
    purchasePrice: z.number().min(0).optional(),
    taxPercentage: z.number().min(0).max(100).optional(),
    currentStock: z.number().min(0).optional(),
    unit: z.string().optional(),
    variants: z.array(variantSchema).optional(),
    featured: z.boolean().optional(),
    fastMoving: z.boolean().optional(),
    active: z.boolean().optional(),
    searchKeywords: z.array(z.string()).optional(),
    minimumStock: z.number().min(0).optional(),
    locationBin: z.string().optional(),
    warranty: z.string().optional(),
    returnEligibility: z.boolean().optional(),
  }),
});

export const updateProductStatusSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
  body: z.object({
    active: z.boolean(),
  }),
});

