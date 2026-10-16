import mongoose from 'mongoose';

const deviceTokenSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Users',
      required: true,
      index: true,
    },
    token: {
      type: String,
      required: [true, 'Device token is required'],
      unique: true,
      trim: true,
    },
    role: {
      type: String,
      enum: ['customer', 'admin', 'delivery_staff', 'inventory_staff', 'sales_staff', 'owner', 'staff'],
      default: 'customer',
      index: true,
    },
    app: {
      type: String,
      enum: ['customer', 'admin', 'delivery'],
      required: true,
      index: true,
    },
    platform: {
      type: String,
      enum: ['android', 'ios', 'web'],
      required: true,
    },
    deviceModel: {
      type: String,
      default: '',
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    lastUsedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

deviceTokenSchema.index({ user: 1, app: 1, isActive: 1 });
deviceTokenSchema.index({ role: 1, isActive: 1 });

export const DeviceToken =
  mongoose.models.DeviceToken || mongoose.model('DeviceToken', deviceTokenSchema);
export default DeviceToken;
