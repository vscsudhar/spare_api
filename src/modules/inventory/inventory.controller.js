import inventoryService from './inventory.service.js';
import sendResponse from '../../utils/response.js';
import catchAsync from '../../utils/catchAsync.js';

export class InventoryController {
  getAll = catchAsync(async (req, res) => {
    const data = await inventoryService.getAll();
    return sendResponse(res, 200, 'Inventory items retrieved successfully', data);
  });

  getSummary = catchAsync(async (req, res) => {
    const data = await inventoryService.getSummary();
    return sendResponse(res, 200, 'Inventory summary calculated successfully', data);
  });

  getLowStock = catchAsync(async (req, res) => {
    const data = await inventoryService.getLowStock();
    return sendResponse(res, 200, 'Low stock items retrieved successfully', data);
  });

  getOutOfStock = catchAsync(async (req, res) => {
    const data = await inventoryService.getOutOfStock();
    return sendResponse(res, 200, 'Out of stock items retrieved successfully', data);
  });

  getMovements = catchAsync(async (req, res) => {
    const data = await inventoryService.getMovements(req.params.productId);
    return sendResponse(res, 200, 'Stock movements retrieved successfully', data);
  });

  createAdjustment = catchAsync(async (req, res) => {
    const { productId, quantity, reason } = req.body;
    const userId = req.user._id;

    const data = await inventoryService.createAdjustment(productId, quantity, reason, userId);

    return sendResponse(res, 201, 'Stock adjusted successfully', data);
  });
}

export default new InventoryController();
