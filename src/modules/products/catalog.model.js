import mongoose from 'mongoose';

const vehicleTypeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Vehicle type name is required'],
      unique: true,
      trim: true,
    },
    slug: {
      type: String,
      required: [true, 'Slug is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },
  },
  { timestamps: true }
);

const vehicleBrandSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Brand name is required'],
      unique: true,
      trim: true,
    },
    slug: {
      type: String,
      required: [true, 'Slug is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    vehicleType: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'VehicleType',
      required: [true, 'Vehicle type is required'],
    },
  },
  { timestamps: true }
);

const vehicleModelSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Model name is required'],
      trim: true,
    },
    slug: {
      type: String,
      required: [true, 'Slug is required'],
      lowercase: true,
      trim: true,
    },
    brand: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'VehicleBrand',
      required: [true, 'Brand is required'],
    },
    type: {
      type: String,
      enum: ['EV', 'Petrol', 'Universal'],
      required: true,
      default: 'Universal',
    },
    years: [
      {
        type: String,
        trim: true,
      },
    ],
  },
  { timestamps: true }
);

// Ensure name is unique per brand
vehicleModelSchema.index({ name: 1, brand: 1 }, { unique: true });
vehicleModelSchema.index({ slug: 1, brand: 1 }, { unique: true });

export const VehicleType = mongoose.models.VehicleType || mongoose.model('VehicleType', vehicleTypeSchema);
export const VehicleBrand = mongoose.models.VehicleBrand || mongoose.model('VehicleBrand', vehicleBrandSchema);
export const VehicleModel = mongoose.models.VehicleModel || mongoose.model('VehicleModel', vehicleModelSchema);
