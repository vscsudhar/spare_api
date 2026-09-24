import mongoose from 'mongoose';

const locationInventorySchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Products',
      required: [true, 'Product ID is required'],
    },
    locationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Location',
      required: [true, 'Location ID is required'],
    },
    quantity: {
      type: Number,
      required: [true, 'Quantity is required'],
      min: [0, 'Quantity cannot be negative'],
      default: 0,
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

// Compound unique index ensuring one inventory record per product per location
locationInventorySchema.index({ productId: 1, locationId: 1 }, { unique: true });
locationInventorySchema.index({ locationId: 1 });

export const LocationInventory =
  mongoose.models.LocationInventory || mongoose.model('LocationInventory', locationInventorySchema);

export default LocationInventory;
