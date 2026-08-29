import mongoose from 'mongoose';

const cartItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Products',
      required: [true, 'Product reference is required'],
    },
    quantity: {
      type: Number,
      required: [true, 'Quantity is required'],
      min: [1, 'Quantity must be at least 1'],
      default: 1,
    },
    variantId: {
      type: mongoose.Schema.Types.ObjectId,
    },
  },
  {
    timestamps: true,
  }
);

const cartSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Users',
      required: true,
      unique: true,
    },
    items: [cartItemSchema],
    coupon: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Coupon',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

export const Cart = mongoose.models.Cart || mongoose.model('Cart', cartSchema);
export default Cart;
