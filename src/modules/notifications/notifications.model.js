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
    image: {
      type: String,
      default: null,
      trim: true,
    },
    type: {
      type: String,
      enum: [
        'new_order',
        'order_status',
        'delivery_assignment',
        'new_rare_request',
        'new_chat_message',
        'rare_product_chat',
        'rare_product_status',
        'quotation',
        'support_ticket_created',
        'support_ticket_status',
        'support_ticket_message',
        'ticket_chat',
        'manual_single',
        'manual_bulk',
        'promotional',
        'broadcast',
        'low_stock',
        'supplier_payment_due',
        'purchase_received',
      ],
      required: true,
      default: 'manual_single',
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
    sentBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Users',
      default: null,
    },
    targetAudience: {
      type: String,
      default: 'individual',
    },
  },
  {
    timestamps: true,
  }
);

notificationsSchema.index({ user: 1, read: 1 });
notificationsSchema.index({ createdAt: -1 });
notificationsSchema.index({ type: 1 });

export const Notifications =
  mongoose.models.Notifications || mongoose.model('Notifications', notificationsSchema);
export default Notifications;
