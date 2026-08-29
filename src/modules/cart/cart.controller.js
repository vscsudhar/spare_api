import cartService from './cart.service.js';
import sendResponse from '../../utils/response.js';
import catchAsync from '../../utils/catchAsync.js';

export class CartController {
  getCart = catchAsync(async (req, res) => {
    const data = await cartService.getCart(req.user._id);
    return sendResponse(res, 200, 'Cart retrieved successfully', data);
  });

  addItem = catchAsync(async (req, res) => {
    const data = await cartService.addItem(req.user._id, req.body);
    return sendResponse(res, 200, 'Item added to cart successfully', data);
  });

  updateItem = catchAsync(async (req, res) => {
    const { quantity } = req.body;
    const data = await cartService.updateItem(req.user._id, req.params.itemId, quantity);
    return sendResponse(res, 200, 'Cart item quantity updated successfully', data);
  });

  removeItem = catchAsync(async (req, res) => {
    const data = await cartService.removeItem(req.user._id, req.params.itemId);
    return sendResponse(res, 200, 'Item removed from cart successfully', data);
  });

  clearCart = catchAsync(async (req, res) => {
    const data = await cartService.clearCart(req.user._id);
    return sendResponse(res, 200, 'Cart cleared successfully', data);
  });

  applyCoupon = catchAsync(async (req, res) => {
    const { code } = req.body;
    const data = await cartService.applyCoupon(req.user._id, code);
    return sendResponse(res, 200, 'Coupon applied successfully', data);
  });

  removeCoupon = catchAsync(async (req, res) => {
    const data = await cartService.removeCoupon(req.user._id);
    return sendResponse(res, 200, 'Coupon removed successfully', data);
  });
}

export default new CartController();
