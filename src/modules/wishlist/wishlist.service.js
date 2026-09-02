import AppError from '../../errors/AppError.js';
import Wishlist from './wishlist.model.js';
import Products from '../products/products.model.js';

export const wishlistService = {
  /**
   * Retrieve user wishlist populated with product details
   */
  getWishlist: async (userId) => {
    let wishlist = await Wishlist.findOne({ user: userId }).populate({
      path: 'products',
      populate: [
        { path: 'category' },
        { path: 'vehicleType' },
        { path: 'compatibilities.brand' },
        { path: 'compatibilities.model' },
      ],
    });
    if (!wishlist) {
      wishlist = await Wishlist.create({ user: userId, products: [] });
    }

    const products = (wishlist.products || [])
      .filter((p) => p != null && p._id)
      .map((p) => {
        const obj = p.toObject ? p.toObject() : { ...p };
        return {
          ...obj,
          isWishlist: true,
        };
      });

    return products;
  },

  /**
   * Add product to wishlist
   */
  addProduct: async (userId, productId) => {
    const product = await Products.findById(productId);
    if (!product) {
      throw new AppError('Product not found.', 404);
    }

    let wishlist = await Wishlist.findOne({ user: userId });
    if (!wishlist) {
      wishlist = new Wishlist({ user: userId, products: [] });
    }

    const exists = wishlist.products.some((id) => id.toString() === productId.toString());
    if (!exists) {
      wishlist.products.push(productId);
      await wishlist.save();
    }

    return {
      productId,
      isWishlist: true,
    };
  },

  /**
   * Remove product from wishlist
   */
  removeProduct: async (userId, productId) => {
    const wishlist = await Wishlist.findOne({ user: userId });
    if (wishlist) {
      wishlist.products = wishlist.products.filter(
        (id) => id.toString() !== productId.toString()
      );
      await wishlist.save();
    }

    return {
      productId,
      isWishlist: false,
    };
  },

  /**
   * Toggle product in wishlist
   */
  toggleWishlist: async (userId, productId) => {
    const product = await Products.findById(productId);
    if (!product) {
      throw new AppError('Product not found.', 404);
    }

    let wishlist = await Wishlist.findOne({ user: userId });
    if (!wishlist) {
      wishlist = new Wishlist({ user: userId, products: [] });
    }

    const index = wishlist.products.findIndex(
      (id) => id.toString() === productId.toString()
    );

    let isWishlist = false;
    if (index > -1) {
      wishlist.products.splice(index, 1);
      isWishlist = false;
    } else {
      wishlist.products.push(productId);
      isWishlist = true;
    }

    await wishlist.save();

    return {
      productId,
      isWishlist,
    };
  },
};

export default wishlistService;
