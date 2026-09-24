import { z } from 'zod';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;
const objectIdSchema = z.string().regex(objectIdRegex, 'Invalid ObjectId format');

const strongPassword = z.string().min(6, 'Password must be at least 6 characters long');

export const idParamSchema = z.object({
  params: z.object({
    id: z.string(),
  }),
});

export const createStaffSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Name is required').trim(),
    email: z.string().email('Invalid email address').trim().toLowerCase(),
    phone: z.string().optional(),
    password: strongPassword.optional(),
    role: z.string().optional(),
    locationId: z.string().nullable().optional(),
    shift: z.string().optional(),
    permissions: z.array(z.string()).optional().default([]),
    status: z.string().optional().default('active'),
  }),
});

export const updateStaffSchema = z.object({
  params: z.object({
    id: z.string(),
  }),
  body: z.object({
    name: z.string().min(1).optional(),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    password: z.string().min(6).optional(),
    role: z.string().optional(),
    locationId: z.string().nullable().optional(),
    shift: z.string().optional(),
    status: z.string().optional(),
    profileImage: z.string().optional(),
  }),
});

export const updateStaffStatusSchema = z.object({
  params: z.object({
    id: z.string(),
  }),
  body: z.object({
    status: z.string(),
  }),
});

export const updateStaffRoleSchema = z.object({
  params: z.object({
    id: z.string(),
  }),
  body: z.object({
    role: z.string(),
    permissions: z.array(z.string()).optional(),
  }),
});

export const createRoleSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Role name is required').trim().toLowerCase(),
    description: z.string().optional(),
    permissions: z.array(z.string()).optional().default([]),
  }),
});

export const updateRoleSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
  body: z.object({
    name: z.string().min(1).trim().toLowerCase().optional(),
    description: z.string().optional(),
    permissions: z.array(z.string()).optional(),
  }),
});

export const updateProfileSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Name cannot be blank').trim().optional(),
    email: z.string().email('Invalid email address').optional(),
    phone: z.string().min(1, 'Phone cannot be blank').optional(),
    password: z.string().min(6).optional(),
    profileImage: z.string().optional(),
  }),
});
