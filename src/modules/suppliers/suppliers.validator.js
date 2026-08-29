import { z } from 'zod';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;
const objectIdSchema = z.string().regex(objectIdRegex, 'Invalid ObjectId format');

export const idParamSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
});

const contactSchema = z.object({
  name: z.string().min(1, 'Contact name is required').trim(),
  email: z.string().email('Invalid contact email').optional().or(z.literal('')),
  phone: z.string().optional(),
  designation: z.string().optional(),
});

export const createSupplierSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Supplier name is required').trim(),
    code: z.string().min(1, 'Supplier code is required').trim().toUpperCase(),
    email: z.string().email('Invalid email').optional().or(z.literal('')),
    phone: z.string().optional(),
    gstNumber: z.string().optional(),
    address: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    bankDetails: z
      .object({
        bankName: z.string().optional(),
        accountNumber: z.string().optional(),
        ifscCode: z.string().optional(),
        accountName: z.string().optional(),
      })
      .optional(),
    upiId: z.string().optional(),
    creditLimit: z.number().min(0).optional().default(0),
    paymentTerms: z.string().optional().default('COD'),
    vehicleCategories: z.array(z.enum(['EV', 'Petrol', 'Universal'])).optional().default(['Universal']),
    contacts: z.array(contactSchema).optional().default([]),
  }),
});

export const updateSupplierSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
  body: z.object({
    name: z.string().min(1).optional(),
    code: z.string().min(1).toUpperCase().optional(),
    email: z.string().email().optional().or(z.literal('')),
    phone: z.string().optional(),
    gstNumber: z.string().optional(),
    address: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    bankDetails: z
      .object({
        bankName: z.string().optional(),
        accountNumber: z.string().optional(),
        ifscCode: z.string().optional(),
        accountName: z.string().optional(),
      })
      .optional(),
    upiId: z.string().optional(),
    creditLimit: z.number().min(0).optional(),
    paymentTerms: z.string().optional(),
    vehicleCategories: z.array(z.enum(['EV', 'Petrol', 'Universal'])).optional(),
    contacts: z.array(contactSchema).optional(),
  }),
});

export const updateSupplierStatusSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
  body: z.object({
    status: z.enum(['active', 'inactive']),
  }),
});

export const createSupplierProductSchema = z.object({
  params: z.object({
    id: objectIdSchema, // Supplier ID
  }),
  body: z.object({
    productId: objectIdSchema,
    supplierSku: z.string().optional().default(''),
    lastPurchasePrice: z.number().min(0).optional().default(0),
  }),
});

export const createSupplierPaymentSchema = z.object({
  params: z.object({
    id: objectIdSchema, // Supplier ID
  }),
  body: z.object({
    amount: z.number().min(0.01, 'Payment amount must be greater than zero'),
    paymentDate: z.string().optional(),
    paymentMethod: z.enum(['bank_transfer', 'upi', 'cash', 'cheque']),
    transactionReference: z.string().optional(),
    notes: z.string().optional(),
  }),
});
