import mongoose from 'mongoose';

const deliveryChargeSchema = new mongoose.Schema(
  {
    fromAmount: {
      type: Number,
      required: [true, 'From amount is required'],
      default: 0,
      min: 0,
    },
    toAmount: {
      type: Number,
      default: null,
    },
    deliveryCharge: {
      type: Number,
      required: [true, 'Delivery charge is required'],
      default: 0,
      min: 0,
    },
    locationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Location',
      default: null,
    },
    locationName: {
      type: String,
      default: 'All Locations (HQ)',
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

deliveryChargeSchema.index({ isActive: 1, locationId: 1, fromAmount: 1 });

export const DeliveryCharge =
  mongoose.models.DeliveryCharge ||
  mongoose.model('DeliveryCharge', deliveryChargeSchema);

export default DeliveryCharge;
