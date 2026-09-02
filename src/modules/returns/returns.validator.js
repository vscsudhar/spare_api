import { z } from 'zod';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

const returnItemSchema = z.object({
  orderItemId: z.string().regex(objectIdRegex, 'Invalid order item ID format'),
  action: z.enum(['return', 'damage', 'exchange']),
  quantity: z.number().int().min(1, 'Quantity must be at least 1'),
  reasonCode: z.string().optional().default(''),
  reasonText: z.string().min(1, 'Reason description is required'),
  condition: z.enum([
    'sealed',
    'unused',
    'opened',
    'used',
    'damaged',
    'defective',
    'incomplete',
    'missing_packaging',
    'unknown',
  ]).optional().default('unused'),
  inventoryDisposition: z.enum([
    'sellable',
    'damaged',
    'vendor',
    'scrap',
    'none',
  ]).optional().default('sellable'),
  refundRequired: z.boolean().optional().default(false),
  refundMethod: z.enum([
    'cash',
    'upi',
    'card',
    'bank_transfer',
    'original',
    'store_credit',
    'none',
  ]).optional().default('none'),
  replacementProductId: z.string().regex(objectIdRegex, 'Invalid replacement product ID format').nullable().optional(),
  replacementQuantity: z.number().int().min(1).nullable().optional(),
  damageType: z.enum([
    'physical',
    'broken',
    'scratched',
    'electrical',
    'packaging',
    'missing_part',
    'defect',
    'other',
    'na',
  ]).optional().default('na'),
  damageDiscoveredAt: z.enum([
    'customer',
    'delivery',
    'store',
    'warehouse',
    'na',
  ]).optional().default('na'),
  damageResolution: z.enum([
    'no_refund',
    'refund',
    'replacement',
    'exchange',
    'vendor_claim',
    'scrap',
    'na',
  ]).optional().default('na'),
  notes: z.string().optional().default(''),
  images: z.array(z.string()).optional().default([]),
});

export const createCaseSchema = z.object({
  body: z.object({
    orderId: z.string().regex(objectIdRegex, 'Invalid order ID format'),
    items: z.array(returnItemSchema).min(1, 'At least one item must be specified'),
    adminNotes: z.string().optional().default(''),
  }),
});

export const updateCaseStatusSchema = z.object({
  body: z.object({
    status: z.enum([
      'pending',
      'approved',
      'rejected',
      'received',
      'processing',
      'completed',
      'cancelled',
    ]),
    notes: z.string().optional().default(''),
  }),
});
