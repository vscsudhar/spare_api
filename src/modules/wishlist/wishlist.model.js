import mongoose from 'mongoose';

const wishlistSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Users',
      required: true,
      unique: true,
    },
    products: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Products',
      },
    ],
  },
  {
    timestamps: true,
  }
);

export const Wishlist = mongoose.models.Wishlist || mongoose.model('Wishlist', wishlistSchema);
export default Wishlist;
