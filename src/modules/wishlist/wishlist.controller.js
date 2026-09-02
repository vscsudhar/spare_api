import wishlistService from './wishlist.service.js';
import sendResponse from '../../utils/response.js';
import catchAsync from '../../utils/catchAsync.js';

export class WishlistController {
  getWishlist = catchAsync(async (req, res) => {
    const data = await wishlistService.getWishlist(req.user._id);
    return sendResponse(res, 200, 'Wishlist fetched successfully', data);
  });

  addProduct = catchAsync(async (req, res) => {
    const data = await wishlistService.addProduct(req.user._id, req.params.productId);
    return sendResponse(res, 200, 'Product added to wishlist', data);
  });

  removeProduct = catchAsync(async (req, res) => {
    const data = await wishlistService.removeProduct(req.user._id, req.params.productId);
    return sendResponse(res, 200, 'Product removed from wishlist', data);
  });

  toggleWishlist = catchAsync(async (req, res) => {
    const data = await wishlistService.toggleWishlist(req.user._id, req.params.productId);
    return sendResponse(res, 200, 'Wishlist updated successfully', data);
  });
}

export default new WishlistController();
