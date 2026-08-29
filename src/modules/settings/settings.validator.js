import { z } from 'zod';

export const updateGeneralSchema = z.object({
  body: z.object({
    appName: z.string().min(1, 'App name is required').optional(),
    supportEmail: z.string().email('Invalid support email address').optional(),
    supportPhone: z.string().min(1, 'Support phone is required').optional(),
  }),
});

export const updateBillingSchema = z.object({
  body: z.object({
    taxPercentage: z.number().min(0).max(100, 'Tax percentage must be between 0 and 100').optional(),
    currency: z.string().min(1, 'Currency is required').optional(),
    invoicePrefix: z.string().min(1, 'Invoice prefix is required').optional(),
  }),
});

export const updatePosSchema = z.object({
  body: z.object({
    allowSplitPayment: z.boolean().optional(),
    minSplitAmount: z.number().int().min(0, 'Minimum split amount cannot be negative').optional(), // paise
    maxSplitMethods: z.number().int().min(1, 'Max split methods must be at least 1').optional(),
    paymentMethods: z.array(z.string().min(1)).min(1, 'At least one payment method is required').optional(),
  }),
});

export const updateInventorySchema = z.object({
  body: z.object({
    lowStockThreshold: z.number().int().min(0, 'Low stock threshold cannot be negative').optional(),
    autoReorderAlert: z.boolean().optional(),
  }),
});

export const updateNotificationsSchema = z.object({
  body: z.object({
    enableEmailAlerts: z.boolean().optional(),
    enableSmsAlerts: z.boolean().optional(),
    lowStockAlertEmail: z.string().email('Invalid alert email address').optional(),
  }),
});

export const updateAppearanceSchema = z.object({
  body: z.object({
    theme: z.enum(['light', 'dark', 'system']).optional(),
    primaryColor: z.string().min(1).optional(),
    sidebarMode: z.enum(['expanded', 'collapsed']).optional(),
  }),
});

export const updateSecuritySchema = z.object({
  body: z.object({
    requireTwoFactor: z.boolean().optional(),
    passwordExpiryDays: z.number().int().min(0).optional(),
  }),
});
