import mongoose from 'mongoose';

const inventoryItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Products',
      required: [true, 'Product reference is required'],
      unique: true,
    },
    currentStock: {
      type: Number,
      required: true,
      default: 0,
      min: [0, 'Stock cannot be negative'],
    },
    reservedStock: {
      type: Number,
      required: true,
      default: 0,
      min: [0, 'Reserved stock cannot be negative'],
    },
    minimumStock: {
      type: Number,
      required: true,
      default: 0,
      min: [0, 'Minimum stock cannot be negative'],
    },
    locationBin: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

const stockMovementSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Products',
      required: true,
    },
    type: {
      type: String,
      enum: [
        'opening',
        'purchase',
        'sale',
        'return',
        'adjustment',
        'damage',
        'reservation',
        'reservation_release',
      ],
      required: true,
    },
    quantity: {
      type: Number,
      required: true, // positive or negative
    },
    referenceType: {
      type: String,
      trim: true, // e.g., 'PurchaseOrder', 'StockAdjustment', 'SalesOrder'
    },
    referenceId: {
      type: mongoose.Schema.Types.ObjectId,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Users',
    },
    notes: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

const stockAdjustmentSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Products',
      required: true,
    },
    quantity: {
      type: Number,
      required: true, // positive for increase, negative for decrease
    },
    reason: {
      type: String,
      required: [true, 'Reason for adjustment is required'],
      trim: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Users',
      required: true,
    },
  },
  { timestamps: true }
);

const stockReservationSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Products',
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: [1, 'Must reserve at least 1 item'],
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ['active', 'completed', 'released'],
      default: 'active',
      required: true,
    },
  },
  { timestamps: true }
);

export const InventoryItem =
  mongoose.models.InventoryItem || mongoose.model('InventoryItem', inventoryItemSchema);
export const StockMovement =
  mongoose.models.StockMovement || mongoose.model('StockMovement', stockMovementSchema);
export const StockAdjustment =
  mongoose.models.StockAdjustment || mongoose.model('StockAdjustment', stockAdjustmentSchema);
export const StockReservation =
  mongoose.models.StockReservation || mongoose.model('StockReservation', stockReservationSchema);
