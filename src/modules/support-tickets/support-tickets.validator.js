import { z } from 'zod';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;
const objectIdSchema = z.string().regex(objectIdRegex, 'Invalid ObjectId format');

export const ticketIdParamSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
});

export const createTicketSchema = z.object({
  body: z.object({
    subject: z.string().min(1, 'Subject is required').trim(),
    category: z.enum([
      'General',
      'Order Issue',
      'Payment Query',
      'Product Information',
      'Return/Refund',
      'Delivery',
      'Technical Support',
    ]).optional().default('General'),
    description: z.string().min(1, 'Description is required').trim(),
    priority: z.enum(['low', 'medium', 'high', 'urgent']).optional().default('medium'),
  }),
});

export const sendMessageSchema = z.object({
  body: z.object({
    message: z.string().min(1, 'Message text is required').trim(),
  }),
});

export const updateStatusSchema = z.object({
  body: z.object({
    status: z.enum(['open', 'pending', 'resolved', 'closed']),
  }),
});
