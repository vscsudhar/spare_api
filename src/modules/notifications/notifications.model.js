import mongoose from 'mongoose';

const notificationsSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Users',
      default: null, // null represents global/admin notification
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: [
        'new_order',
        'order_status',
        'new_rare_request',
        'new_chat_message',
        'quotation',
        'low_stock',
        'supplier_payment_due',
        'purchase_received',
      ],
      required: true,
    },
    read: {
      type: Boolean,
      default: false,
    },
    referenceId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    referenceType: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

notificationsSchema.index({ user: 1, read: 1 });
notificationsSchema.index({ createdAt: -1 });

export const Notifications =
  mongoose.models.Notifications || mongoose.model('Notifications', notificationsSchema);
export default Notifications;
