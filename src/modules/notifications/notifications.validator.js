import { z } from 'zod';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const idParamSchema = z.object({
  params: z.object({
    id: z.string().regex(objectIdRegex, 'Invalid ObjectId format'),
  }),
});

export const registerDeviceTokenSchema = z.object({
  body: z.object({
    token: z.string().min(1, 'Device token is required'),
    app: z.enum(['customer', 'admin', 'delivery']).default('customer'),
    platform: z.enum(['android', 'ios', 'web']).default('android'),
    deviceModel: z.string().optional().default(''),
  }),
});

export const removeDeviceTokenSchema = z.object({
  body: z.object({
    token: z.string().min(1, 'Device token is required'),
  }),
});

export const NOTIFICATION_TYPES = [
  'new_order',
  'order_status',
  'delivery_assignment',
  'new_rare_request',
  'new_chat_message',
  'rare_product_chat',
  'rare_product_status',
  'quotation',
  'support_ticket_created',
  'support_ticket_status',
  'support_ticket_message',
  'ticket_chat',
  'manual_single',
  'manual_bulk',
  'promotional',
  'broadcast',
  'low_stock',
  'supplier_payment_due',
  'purchase_received',
];

export const sendSingleNotificationSchema = z.object({
  body: z.object({
    customerId: z.string().regex(objectIdRegex, 'Invalid customer ID format'),
    title: z.string().min(1, 'Title is required').max(150, 'Title cannot exceed 150 characters'),
    message: z.string().min(1, 'Message is required').max(1000, 'Message cannot exceed 1000 characters'),
    image: z.string().optional().nullable().default(null),
    type: z.enum(NOTIFICATION_TYPES).optional().default('manual_single'),
    data: z.record(z.any()).optional().nullable().transform((v) => v || {}),
  }),
});

export const sendBulkNotificationSchema = z.object({
  body: z.object({
    title: z.string().min(1, 'Title is required').max(150, 'Title cannot exceed 150 characters'),
    message: z.string().min(1, 'Message is required').max(1000, 'Message cannot exceed 1000 characters'),
    image: z.string().optional().nullable().default(null),
    targetAudience: z.preprocess(
      (val) => (!val || val === 'all' ? 'all_customers' : val),
      z.enum(['all_customers', 'active_customers']).default('all_customers')
    ),
    type: z.enum(NOTIFICATION_TYPES).optional().default('manual_bulk'),
    data: z.record(z.any()).optional().nullable().transform((v) => v || {}),
  }),
});

export const adminHistoryQuerySchema = z.object({
  query: z.object({
    page: z.string().regex(/^\d+$/).optional().default('1'),
    limit: z.string().regex(/^\d+$/).optional().default('20'),
    type: z.string().optional(),
    search: z.string().optional(),
  }),
});

export const customersQuerySchema = z.object({
  query: z.object({
    search: z.string().optional().default(''),
    limit: z.string().regex(/^\d+$/).optional().default('20'),
  }),
});

export const batchIdsSchema = z.object({
  body: z.object({
    ids: z.array(z.string().regex(objectIdRegex, 'Invalid ObjectId format')).min(1, 'At least one ID is required'),
  }),
});
