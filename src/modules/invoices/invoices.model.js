import mongoose from 'mongoose';

const invoiceItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Products',
  },
  productId: {
    type: String,
    trim: true,
  },
  productName: {
    type: String,
    required: [true, 'Product name is required'],
    trim: true,
  },
  name: {
    type: String,
    trim: true,
  },
  sku: {
    type: String,
    required: [true, 'SKU is required'],
    trim: true,
  },
  hsnCode: {
    type: String,
    default: '8708',
    trim: true,
  },
  quantity: {
    type: Number,
    required: [true, 'Quantity is required'],
    min: [1, 'Quantity must be at least 1'],
  },
  actualPrice: {
    type: Number,
    required: true,
    min: 0,
  },
  sellingPrice: {
    type: Number,
    required: true,
    min: 0,
  },
  unitPrice: {
    type: Number,
    required: true,
    min: 0,
  },
  taxableValue: {
    type: Number,
    required: true,
    min: 0,
  },
  amount: {
    type: Number,
    min: 0,
  },
  taxAmount: {
    type: Number,
    required: true,
    default: 0,
    min: 0,
  },
  tax: {
    type: Number,
    default: 0,
    min: 0,
  },
  taxPercentage: {
    type: Number,
    required: true,
    default: 18,
  },
  cgstRate: {
    type: Number,
    default: 0,
  },
  cgstAmount: {
    type: Number,
    default: 0,
  },
  sgstRate: {
    type: Number,
    default: 0,
  },
  sgstAmount: {
    type: Number,
    default: 0,
  },
  igstRate: {
    type: Number,
    default: 0,
  },
  igstAmount: {
    type: Number,
    default: 0,
  },
  total: {
    type: Number,
    required: true,
    min: 0,
  },
});

const invoiceCustomerSchema = new mongoose.Schema({
  name: { type: String, default: 'Valued Customer', trim: true },
  phone: { type: String, default: '', trim: true },
  address: { type: String, default: '', trim: true },
  addressLine1: { type: String, default: '', trim: true },
  addressLine2: { type: String, default: '', trim: true },
  city: { type: String, default: '', trim: true },
  state: { type: String, default: 'Tamil Nadu', trim: true },
  stateCode: { type: String, default: '33', trim: true },
  postalCode: { type: String, default: '', trim: true },
  country: { type: String, default: 'India', trim: true },
  gstin: { type: String, default: 'URP (Unregistered Person)', trim: true },
});

const invoiceBusinessSchema = new mongoose.Schema({
  name: { type: String, default: 'VoltSpare Automotive', trim: true },
  legalName: { type: String, default: 'VoltSpare Automotive Technologies Pvt. Ltd.', trim: true },
  addressLine1: { type: String, default: '12, MG Road, Landmark Block', trim: true },
  addressLine2: { type: String, default: 'Indiranagar Commercial Zone', trim: true },
  city: { type: String, default: 'Bangalore', trim: true },
  state: { type: String, default: 'Karnataka', trim: true },
  stateCode: { type: String, default: '29', trim: true },
  postalCode: { type: String, default: '560001', trim: true },
  phone: { type: String, default: '+91 99000 88000', trim: true },
  email: { type: String, default: 'billing@voltspare.com', trim: true },
  gstin: { type: String, default: '29AAAAA0000A1Z1', trim: true },
  pan: { type: String, default: 'AAAAA0000A', trim: true },
  website: { type: String, default: 'www.voltspare.com', trim: true },
});

const invoiceSchema = new mongoose.Schema(
  {
    invoiceNumber: {
      type: String,
      required: [true, 'Invoice number is required'],
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: [true, 'Order reference is required'],
      unique: true,
      index: true,
    },
    orderNumber: {
      type: String,
      required: [true, 'Order number is required'],
      trim: true,
      uppercase: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Users',
      required: true,
      index: true,
    },
    invoiceDate: {
      type: Date,
      default: Date.now,
      required: true,
    },
    orderDate: {
      type: Date,
      required: true,
    },
    customer: {
      type: invoiceCustomerSchema,
      required: true,
    },
    business: {
      type: invoiceBusinessSchema,
      required: true,
      default: () => ({}),
    },
    items: {
      type: [invoiceItemSchema],
      required: true,
      validate: [(val) => val.length > 0, 'Invoice must have at least one item'],
    },
    productAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },
    subTotal: {
      type: Number,
      min: 0,
    },
    taxableAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    taxAmount: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    tax: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalCgst: {
      type: Number,
      default: 0,
    },
    totalSgst: {
      type: Number,
      default: 0,
    },
    totalIgst: {
      type: Number,
      default: 0,
    },
    totalTax: {
      type: Number,
      default: 0,
    },
    discount: {
      type: Number,
      default: 0,
    },
    discountAmount: {
      type: Number,
      default: 0,
    },
    deliveryCharge: {
      type: Number,
      default: 0,
    },
    deliveryFee: {
      type: Number,
      default: 0,
    },
    grandTotal: {
      type: Number,
      required: true,
      min: 0,
    },
    amountInWords: {
      type: String,
      default: '',
    },
    isIntraState: {
      type: Boolean,
      default: true,
    },
    paymentMethod: {
      type: String,
      default: 'Online / Card / UPI',
    },
    paymentStatus: {
      type: String,
      default: 'PAID',
    },
    orderStatus: {
      type: String,
      default: 'processing',
    },
    channel: {
      type: String,
      enum: ['online', 'app', 'pos', 'web'],
      default: 'app',
    },
    fulfillmentHub: {
      type: String,
      default: null,
    },
    terms: {
      type: [String],
      default: [
        'Goods once sold are covered under VoltSpare standard warranty and RMA terms.',
        'All disputes are subject to local jurisdiction only.',
        'This is a computer-generated tax invoice and requires no physical signature under IT Act 2000.',
      ],
    },
  },
  {
    timestamps: true,
  }
);

invoiceSchema.index({ user: 1, createdAt: -1 });

export const Invoice = mongoose.models.Invoice || mongoose.model('Invoice', invoiceSchema);
export default Invoice;
