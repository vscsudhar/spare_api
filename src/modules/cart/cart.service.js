import AppError from '../../errors/AppError.js';
import Cart from './cart.model.js';
import Coupon from './coupons.model.js';
import Products from '../products/products.model.js';

export const cartService = {
  /**
   * Retrieve or initialize user cart
   */
  getCart: async (userId) => {
    let cart = await Cart.findOne({ user: userId }).populate('items.product').populate('coupon');
    if (!cart) {
      cart = await Cart.create({ user: userId, items: [], coupon: null });
    }
    return cart;
  },

  /**
   * Add item to user cart
   */
  addItem: async (userId, data) => {
    const { productId, quantity, variantId } = data;

    // Validate product exists
    const product = await Products.findById(productId);
    if (!product) {
      throw new AppError('Product not found.', 404);
    }

    // If variant is requested, check compatibility
    if (variantId) {
      const variant = product.variants.id(variantId);
      if (!variant) {
        throw new AppError('Product variant not found.', 404);
      }
    }

    let cart = await Cart.findOne({ user: userId });
    if (!cart) {
      cart = new Cart({ user: userId, items: [], coupon: null });
    }

    // Check if item already exists in cart (matching product and variant)
    const existingIndex = cart.items.findIndex(
      (el) =>
        el.product.toString() === productId &&
        (variantId ? el.variantId?.toString() === variantId : !el.variantId)
    );

    if (existingIndex > -1) {
      cart.items[existingIndex].quantity += quantity;
    } else {
      cart.items.push({
        product: productId,
        quantity,
        variantId: variantId || null,
      });
    }

    await cart.save();
    return cartService.getCart(userId);
  },

  /**
   * Update cart item quantity
   */
  updateItem: async (userId, itemId, quantity) => {
    const cart = await Cart.findOne({ user: userId });
    if (!cart) {
      throw new AppError('Cart not found.', 404);
    }

    const item = cart.items.id(itemId);
    if (!item) {
      throw new AppError('Cart item not found.', 404);
    }

    item.quantity = quantity;
    await cart.save();

    return cartService.getCart(userId);
  },

  /**
   * Remove item from cart
   */
  removeItem: async (userId, itemId) => {
    const cart = await Cart.findOne({ user: userId });
    if (!cart) {
      throw new AppError('Cart not found.', 404);
    }

    cart.items = cart.items.filter((el) => el._id.toString() !== itemId);
    await cart.save();

    return cartService.getCart(userId);
  },

  /**
   * Empty cart
   */
  clearCart: async (userId) => {
    const cart = await Cart.findOne({ user: userId });
    if (!cart) {
      throw new AppError('Cart not found.', 404);
    }

    cart.items = [];
    cart.coupon = null;
    await cart.save();

    return cartService.getCart(userId);
  },

  /**
   * Apply discount coupon to cart
   */
  applyCoupon: async (userId, couponCode) => {
    const cart = await Cart.findOne({ user: userId }).populate('items.product');
    if (!cart) {
      throw new AppError('Cart not found.', 404);
    }

    const coupon = await Coupon.findOne({ code: couponCode.toUpperCase() });
    if (!coupon) {
      throw new AppError('Invalid coupon code.', 404);
    }

    // Calculate cart total subTotal
    let cartSubTotal = 0;
    cart.items.forEach((item) => {
      if (item.product) {
        cartSubTotal += item.quantity * item.product.sellingPrice;
      }
    });

    if (!coupon.isValid(cartSubTotal)) {
      throw new AppError(
        `Coupon cannot be applied. Ensure minimum purchase of ₹${coupon.minPurchaseAmount} is met, and coupon is active.`,
        400
      );
    }

    cart.coupon = coupon._id;
    await cart.save();

    return cartService.getCart(userId);
  },

  /**
   * Remove coupon from cart
   */
  removeCoupon: async (userId) => {
    const cart = await Cart.findOne({ user: userId });
    if (!cart) {
      throw new AppError('Cart not found.', 404);
    }

    cart.coupon = null;
    await cart.save();

    return cartService.getCart(userId);
  },
};

export default cartService;
