import mongoose from 'mongoose';

const returnExchangeItemSchema = new mongoose.Schema({
  orderItemId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  },
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Products',
    required: true,
  },
  productNameSnapshot: { type: String, required: true },
  skuSnapshot: { type: String, default: '' },
  unitPrice: { type: Number, required: true }, // in paise
  originalQty: { type: Number, required: true, min: 1 },
  processedQty: { type: Number, required: true, min: 1 },
  action: {
    type: String,
    enum: ['return', 'damage', 'exchange'],
    required: true,
  },
  reasonCode: { type: String, default: '' },
  reasonText: { type: String, required: true },
  condition: {
    type: String,
    enum: [
      'sealed',
      'unused',
      'opened',
      'used',
      'damaged',
      'defective',
      'incomplete',
      'missing_packaging',
      'unknown'
    ],
    default: 'unused',
  },
  inventoryDisposition: {
    type: String,
    enum: ['sellable', 'damaged', 'vendor', 'scrap', 'none'],
    default: 'sellable',
  },
  refundRequired: { type: Boolean, default: false },
  refundAmount: { type: Number, default: 0 }, // in paise
  refundMethod: {
    type: String,
    enum: ['cash', 'upi', 'card', 'bank_transfer', 'original', 'store_credit', 'none'],
    default: 'none',
  },
  refundStatus: {
    type: String,
    enum: ['na', 'pending', 'processed', 'failed'],
    default: 'na',
  },
  replacementProduct: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Products',
    default: null,
  },
  replacementProductNameSnapshot: { type: String, default: '' },
  replacementQty: { type: Number, default: 0 },
  differenceType: {
    type: String,
    enum: ['payable', 'refundable', 'none'],
    default: 'none',
  },
  differenceAmount: { type: Number, default: 0 }, // in paise
  damageType: {
    type: String,
    enum: [
      'physical',
      'broken',
      'scratched',
      'electrical',
      'packaging',
      'missing_part',
      'defect',
      'other',
      'na'
    ],
    default: 'na',
  },
  damageDiscoveredAt: {
    type: String,
    enum: ['customer', 'delivery', 'store', 'warehouse', 'na'],
    default: 'na',
  },
  damageResolution: {
    type: String,
    enum: ['no_refund', 'refund', 'replacement', 'exchange', 'vendor_claim', 'scrap', 'na'],
    default: 'na',
  },
  notes: { type: String, default: '' },
  images: [{ type: String }],
});

const returnExchangeHistorySchema = new mongoose.Schema({
  action: { type: String, required: true },
  fromStatus: { type: String, default: '' },
  toStatus: { type: String, required: true },
  notes: { type: String, default: '' },
  changedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Users',
  },
  changedByName: { type: String, default: 'Admin' },
  timestamp: { type: Date, default: Date.now },
});

const returnExchangeSchema = new mongoose.Schema(
  {
    caseNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
    },
    billNumber: {
      type: String,
      required: true,
      trim: true,
    },
    invoiceNumber: {
      type: String,
      default: '',
      trim: true,
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Users',
    },
    customerSnapshot: {
      name: { type: String, default: 'Walk-in Customer' },
      phone: { type: String, default: '' },
    },
    type: {
      type: String,
      enum: ['return', 'damage', 'exchange', 'mixed'],
      required: true,
    },
    status: {
      type: String,
      enum: [
        'pending',
        'approved',
        'rejected',
        'received',
        'processing',
        'completed',
        'cancelled'
      ],
      default: 'pending',
      required: true,
    },
    items: [returnExchangeItemSchema],
    totalRefundAmount: { type: Number, default: 0 }, // in paise
    totalPayableAmount: { type: Number, default: 0 }, // in paise
    history: [returnExchangeHistorySchema],
    adminNotes: { type: String, default: '' },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Users',
      required: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Users',
    },
  },
  { timestamps: true }
);

// Indexes for fast lookup and search
returnExchangeSchema.index({ order: 1 });
returnExchangeSchema.index({ billNumber: 1 });
returnExchangeSchema.index({ invoiceNumber: 1 });
returnExchangeSchema.index({ status: 1 });
returnExchangeSchema.index({ type: 1 });
returnExchangeSchema.index({ createdAt: -1 });

export const ReturnExchange =
  mongoose.models.ReturnExchange ||
  mongoose.model('ReturnExchange', returnExchangeSchema);

export default ReturnExchange;
