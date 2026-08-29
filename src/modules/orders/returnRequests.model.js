import mongoose from 'mongoose';

const returnCancelRequestSchema = new mongoose.Schema(
  {
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Users',
      required: true,
    },
    type: {
      type: String,
      enum: ['cancel', 'return'],
      required: true,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
      required: true,
    },
    items: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Products',
          required: true,
        },
        quantity: {
          type: Number,
          required: true,
          min: 1,
        },
      },
    ],
    actionedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Users',
      default: null,
    },
    actionedAt: {
      type: Date,
      default: null,
    },
    adminNotes: {
      type: String,
      trim: true,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
returnCancelRequestSchema.index({ order: 1 });
returnCancelRequestSchema.index({ user: 1 });

export const ReturnCancelRequest =
  mongoose.models.ReturnCancelRequest ||
  mongoose.model('ReturnCancelRequest', returnCancelRequestSchema);

export default ReturnCancelRequest;
