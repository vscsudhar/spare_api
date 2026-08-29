import mongoose from 'mongoose';

const couponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: [true, 'Coupon code is required'],
      unique: true,
      uppercase: true,
      trim: true,
    },
    discountType: {
      type: String,
      enum: ['percentage', 'flat'],
      required: [true, 'Discount type is required'],
    },
    discountValue: {
      type: Number,
      required: [true, 'Discount value is required'],
      min: [0, 'Discount value cannot be negative'],
    },
    minPurchaseAmount: {
      type: Number,
      default: 0,
      min: [0, 'Minimum purchase amount cannot be negative'],
    },
    maxDiscountAmount: {
      type: Number, // Applicable for percentage discount
      min: [0, 'Maximum discount amount cannot be negative'],
    },
    expiresAt: {
      type: Date,
      required: [true, 'Expiry date is required'],
    },
    active: {
      type: Boolean,
      default: true,
    },
    usageLimit: {
      type: Number, // Total times this coupon can be used
      default: null,
    },
    usageCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Check if coupon is expired
couponSchema.methods.isExpired = function () {
  return new Date() > this.expiresAt;
};

// Check if coupon is active and valid
couponSchema.methods.isValid = function (purchaseAmount) {
  if (!this.active) return false;
  if (this.isExpired()) return false;
  if (purchaseAmount < this.minPurchaseAmount) return false;
  if (this.usageLimit !== null && this.usageCount >= this.usageLimit) return false;
  return true;
};

export const Coupon = mongoose.models.Coupon || mongoose.model('Coupon', couponSchema);
export default Coupon;
