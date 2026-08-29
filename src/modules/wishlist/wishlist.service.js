import AppError from '../../errors/AppError.js';
import Wishlist from './wishlist.model.js';
import Products from '../products/products.model.js';

export const wishlistService = {
  /**
   * Retrieve or initialize user wishlist
   */
  getWishlist: async (userId) => {
    let wishlist = await Wishlist.findOne({ user: userId }).populate('products');
    if (!wishlist) {
      wishlist = await Wishlist.create({ user: userId, products: [] });
    }
    return wishlist;
  },

  /**
   * Add product to wishlist
   */
  addProduct: async (userId, productId) => {
    // Validate product exists
    const product = await Products.findById(productId);
    if (!product) {
      throw new AppError('Product not found.', 404);
    }

    let wishlist = await Wishlist.findOne({ user: userId });
    if (!wishlist) {
      wishlist = new Wishlist({ user: userId, products: [] });
    }

    if (!wishlist.products.includes(productId)) {
      wishlist.products.push(productId);
      await wishlist.save();
    }

    return wishlist.populate('products');
  },

  /**
   * Remove product from wishlist
   */
  removeProduct: async (userId, productId) => {
    const wishlist = await Wishlist.findOne({ user: userId });
    if (!wishlist) {
      throw new AppError('Wishlist not found.', 404);
    }

    wishlist.products = wishlist.products.filter((id) => id.toString() !== productId);
    await wishlist.save();

    return wishlist.populate('products');
  },
};

export default wishlistService;
