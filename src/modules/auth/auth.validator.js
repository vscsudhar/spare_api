import { z } from 'zod';

// Password validation helper
const strongPassword = z
  .string()
  .min(6, 'Password must be at least 6 characters long');

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
    email: z.string().optional(),
    token: z.string().optional(),
    resetToken: z.string().optional(),
    password: strongPassword,
    confirmPassword: z.string().optional(),
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
    email: z.string().optional(),
    phone: z.string().optional(),
  }).refine((data) => data.email || data.phone, {
    message: 'Either email or phone must be provided',
    path: ['email'],
  }),
});

export const verifyOtpSchema = z.object({
  body: z.object({
    identifier: z.string().optional(),
    email: z.string().optional(),
    phone: z.string().optional(),
    otp: z.string().min(1, 'OTP is required'),
  }).refine((data) => data.identifier || data.email || data.phone, {
    message: 'Either identifier, email, or phone must be provided',
    path: ['identifier'],
  }),
});
