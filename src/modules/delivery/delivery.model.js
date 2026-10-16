import mongoose from 'mongoose';

const deliveryPaymentSchema = new mongoose.Schema(
  {
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: [true, 'Order reference is required'],
      index: true,
    },
    driver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Users',
      required: [true, 'Delivery driver reference is required'],
      index: true,
    },
    amount: {
      type: Number,
      required: [true, 'Collected amount is required'],
      min: [0, 'Amount cannot be negative'],
    },
    paymentMethod: {
      type: String,
      default: 'Cash on Delivery',
      trim: true,
    },
    transactionReference: {
      type: String,
      trim: true,
      default: '',
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
    status: {
      type: String,
      enum: ['collected', 'verified', 'cancelled'],
      default: 'collected',
      required: true,
    },
    collectedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

deliveryPaymentSchema.index({ driver: 1, collectedAt: -1 });
deliveryPaymentSchema.index({ order: 1, status: 1 });

export const DeliveryPayment =
  mongoose.models.DeliveryPayment || mongoose.model('DeliveryPayment', deliveryPaymentSchema);

export default DeliveryPayment;
