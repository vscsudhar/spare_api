import mongoose from 'mongoose';

const addressesSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Users',
      required: [true, 'User reference is required'],
    },
    name: {
      type: String,
      required: [true, 'Address label is required (e.g. Home, Work)'],
      trim: true,
      default: 'Home',
    },
    recipientName: {
      type: String,
      required: [true, 'Recipient name is required'],
      trim: true,
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
    },
    addressLine1: {
      type: String,
      required: [true, 'Address line 1 is required'],
      trim: true,
    },
    addressLine2: {
      type: String,
      trim: true,
    },
    city: {
      type: String,
      required: [true, 'City is required'],
      trim: true,
    },
    state: {
      type: String,
      required: [true, 'State is required'],
      trim: true,
    },
    postalCode: {
      type: String,
      required: [true, 'Postal code is required'],
      trim: true,
    },
    country: {
      type: String,
      required: [true, 'Country is required'],
      trim: true,
      default: 'India',
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
addressesSchema.index({ user: 1 });

export const Addresses = mongoose.models.Addresses || mongoose.model('Addresses', addressesSchema);
export default Addresses;
