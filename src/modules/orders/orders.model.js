import mongoose from 'mongoose';

const orderItemProductSnapshotSchema = new mongoose.Schema({
  name: { type: String, required: true },
  sku: { type: String, required: true },
  slug: { type: String, required: true },
  sellingPrice: { type: Number, required: true },
  purchasePrice: { type: Number, required: true },
  mrp: { type: Number, required: true },
  image: { type: String, default: '' },
});

const orderItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Products',
    required: true,
  },
  productSnapshot: {
    type: orderItemProductSnapshotSchema,
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
    min: [1, 'Quantity must be at least 1'],
  },
  unitPrice: {
    type: Number,
    required: true,
    min: 0,
  },
  taxPercentage: {
    type: Number,
    required: true,
    default: 18,
  },
  totalPrice: {
    type: Number,
    required: true,
    min: 0,
  },
});

const orderStatusHistorySchema = new mongoose.Schema({
  status: {
    type: String,
    enum: [
      'pending',
      'confirmed',
      'processing',
      'packed',
      'shipped',
      'out_for_delivery',
      'delivered',
      'cancelled',
      'returned',
    ],
    required: true,
  },
  changedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Users',
  },
  notes: {
    type: String,
    trim: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

const orderNotesSchema = new mongoose.Schema({
  text: {
    type: String,
    required: true,
    trim: true,
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Users',
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const deliveryAssignmentSchema = new mongoose.Schema({
  driver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Users',
    required: true,
  },
  status: {
    type: String,
    enum: ['assigned', 'picked_up', 'delivered', 'failed'],
    default: 'assigned',
    required: true,
  },
  assignedAt: {
    type: Date,
    default: Date.now,
  },
  pickedUpAt: {
    type: Date,
  },
  deliveredAt: {
    type: Date,
  },
  notes: {
    type: String,
    trim: true,
  },
});

const shippingAddressSnapshotSchema = new mongoose.Schema({
  recipientName: { type: String, required: true },
  phone: { type: String, required: true },
  addressLine1: { type: String, required: true },
  addressLine2: { type: String },
  city: { type: String, required: true },
  state: { type: String, required: true },
  postalCode: { type: String, required: true },
  country: { type: String, required: true, default: 'India' },
});

const orderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      required: [true, 'Order number is required'],
      unique: true,
      trim: true,
      uppercase: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Users',
      required: true,
    },
    items: [orderItemSchema],
    status: {
      type: String,
      enum: [
        'pending',
        'confirmed',
        'processing',
        'packed',
        'shipped',
        'out_for_delivery',
        'delivered',
        'cancelled',
        'returned',
      ],
      default: 'pending',
      required: true,
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'unpaid', 'partially_paid', 'paid', 'failed', 'refunded', 'partially_refunded'],
      default: 'unpaid',
      required: true,
    },
    shippingAddress: {
      type: shippingAddressSnapshotSchema,
      required: true,
    },
    subTotal: {
      type: Number,
      required: true,
      default: 0,
    },
    taxAmount: {
      type: Number,
      required: true,
      default: 0,
    },
    discountAmount: {
      type: Number,
      required: true,
      default: 0,
    },
    deliveryFee: {
      type: Number,
      required: true,
      default: 0,
    },
    grandTotal: {
      type: Number,
      required: true,
      default: 0,
    },
    couponCode: {
      type: String,
      trim: true,
      uppercase: true,
    },
    notes: [orderNotesSchema],
    statusHistory: [orderStatusHistorySchema],
    deliveryAssignment: {
      type: deliveryAssignmentSchema,
      default: null,
    },
    idempotencyKey: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
orderSchema.index({ user: 1 });
orderSchema.index({ idempotencyKey: 1 }, { unique: true, sparse: true });

export const Order = mongoose.models.Order || mongoose.model('Order', orderSchema);
export default Order;
