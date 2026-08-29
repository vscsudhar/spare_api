import { z } from 'zod';

// Password validation helper
const strongPassword = z
  .string()
  .min(8, 'Password must be at least 8 characters long')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character');

export const adminLoginSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(1, 'Password is required'),
  }),
});

export const customerRegisterSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Name is required').trim(),
    email: z.string().email('Invalid email address').trim().toLowerCase(),
    phone: z.string().min(5, 'Phone number is required').trim(),
    password: strongPassword,
  }),
});

export const customerLoginSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address').trim().toLowerCase(),
    password: z.string().min(1, 'Password is required'),
  }),
});

export const refreshTokenSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(1, 'Refresh token is required'),
  }),
});

export const forgotPasswordSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address').trim().toLowerCase(),
  }),
});

export const resetPasswordSchema = z.object({
  body: z.object({
    token: z.string().min(1, 'Token is required'),
    password: strongPassword,
  }),
});

export const changePasswordSchema = z.object({
  body: z.object({
    oldPassword: z.string().min(1, 'Old password is required'),
    newPassword: strongPassword,
  }),
});

export const sendOtpSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address').optional(),
    phone: z.string().min(5, 'Invalid phone number').optional(),
  }).refine((data) => data.email || data.phone, {
    message: 'Either email or phone must be provided',
    path: ['email'],
  }),
});

export const verifyOtpSchema = z.object({
  body: z.object({
    identifier: z.string().min(1, 'Identifier (email or phone) is required'),
    otp: z.string().length(6, 'OTP must be exactly 6 digits'),
  }),
});
