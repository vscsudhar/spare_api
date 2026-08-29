import mongoose from 'mongoose';

const purchaseOrderItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Products',
    required: [true, 'Product reference is required'],
  },
  quantity: {
    type: Number,
    required: [true, 'Quantity is required'],
    min: [1, 'Quantity must be at least 1'],
  },
  unitPrice: {
    type: Number,
    required: [true, 'Unit price is required'],
    min: [0, 'Unit price cannot be negative'],
  },
  taxPercentage: {
    type: Number,
    default: 18,
    min: 0,
    max: 100,
  },
  quantityReceived: {
    type: Number,
    default: 0,
    min: 0,
  },
});

const purchaseOrderSchema = new mongoose.Schema(
  {
    poNumber: {
      type: String,
      required: [true, 'Purchase order number is required'],
      unique: true,
      trim: true,
      uppercase: true,
    },
    supplier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Supplier',
      required: [true, 'Supplier is required'],
    },
    items: [purchaseOrderItemSchema],
    status: {
      type: String,
      enum: ['draft', 'submitted', 'approved', 'ordered', 'partially_received', 'received', 'cancelled'],
      default: 'draft',
      required: true,
    },
    subTotal: {
      type: Number,
      default: 0,
    },
    taxAmount: {
      type: Number,
      default: 0,
    },
    grandTotal: {
      type: Number,
      default: 0,
    },
    notes: {
      type: String,
      trim: true,
    },
    expectedDeliveryDate: {
      type: Date,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Users',
      required: true,
    },
  },
  { timestamps: true }
);

const purchaseReceiptItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Products',
    required: true,
  },
  quantityReceived: {
    type: Number,
    required: true,
    min: [1, 'Quantity received must be at least 1'],
  },
});

const purchaseReceiptSchema = new mongoose.Schema(
  {
    receiptNumber: {
      type: String,
      required: [true, 'Receipt number is required'],
      unique: true,
      trim: true,
      uppercase: true,
    },
    purchaseOrder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PurchaseOrder',
      required: true,
    },
    receivedDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    items: [purchaseReceiptItemSchema],
    receivedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Users',
      required: true,
    },
  },
  { timestamps: true }
);

const purchasePaymentSchema = new mongoose.Schema(
  {
    paymentNumber: {
      type: String,
      required: [true, 'Payment number is required'],
      unique: true,
      trim: true,
      uppercase: true,
    },
    purchaseOrder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PurchaseOrder',
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: [0.01, 'Payment amount must be greater than zero'],
    },
    paymentDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    paymentMethod: {
      type: String,
      enum: ['bank_transfer', 'upi', 'cash', 'cheque'],
      required: true,
    },
    transactionReference: {
      type: String,
      trim: true,
    },
    notes: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

export const PurchaseOrder =
  mongoose.models.PurchaseOrder || mongoose.model('PurchaseOrder', purchaseOrderSchema);
export const PurchaseReceipt =
  mongoose.models.PurchaseReceipt || mongoose.model('PurchaseReceipt', purchaseReceiptSchema);
export const PurchasePayment =
  mongoose.models.PurchasePayment || mongoose.model('PurchasePayment', purchasePaymentSchema);

export default PurchaseOrder;
