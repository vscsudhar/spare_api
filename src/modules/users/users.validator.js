import { z } from 'zod';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;
const objectIdSchema = z.string().regex(objectIdRegex, 'Invalid ObjectId format');

const strongPassword = z
  .string()
  .min(8, 'Password must be at least 8 characters long')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character');

export const idParamSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
});

export const createStaffSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Name is required').trim(),
    email: z.string().email('Invalid email address').trim().toLowerCase(),
    phone: z.string().min(5, 'Phone number is required').trim(),
    password: strongPassword,
    role: objectIdSchema, // Reference to Role ID
    permissions: z.array(objectIdSchema).optional().default([]), // Optional list of custom Permission overrides
    status: z.enum(['active', 'disabled', 'suspended']).optional().default('active'),
  }),
});

export const updateStaffSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
  body: z.object({
    name: z.string().min(1).optional(),
    email: z.string().email().optional(),
    phone: z.string().min(5).optional(),
    profileImage: z.string().optional(),
  }),
});

export const updateStaffStatusSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
  body: z.object({
    status: z.enum(['active', 'disabled', 'suspended']),
  }),
});

export const updateStaffRoleSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
  body: z.object({
    role: objectIdSchema,
    permissions: z.array(objectIdSchema).optional(),
  }),
});

export const createRoleSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Role name is required').trim().toLowerCase(),
    description: z.string().optional(),
    permissions: z.array(objectIdSchema).optional().default([]),
  }),
});

export const updateRoleSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
  body: z.object({
    name: z.string().min(1).trim().toLowerCase().optional(),
    description: z.string().optional(),
    permissions: z.array(objectIdSchema).optional(),
  }),
});

export const updateProfileSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Name cannot be blank').trim().optional(),
    email: z.string().email('Invalid email address').optional(),
    phone: z.string().min(1, 'Phone cannot be blank').optional(),
    profileImage: z.string().optional(),
  }),
});
