import purchasesService from './purchases.service.js';
import sendResponse from '../../utils/response.js';
import catchAsync from '../../utils/catchAsync.js';

export class PurchasesController {
  getAll = catchAsync(async (req, res) => {
    const data = await purchasesService.getAll();
    return sendResponse(res, 200, 'Purchase orders retrieved successfully', data);
  });

  create = catchAsync(async (req, res) => {
    const data = await purchasesService.create(req.body, req.user._id);
    return sendResponse(res, 201, 'Purchase order created successfully', data);
  });

  getById = catchAsync(async (req, res) => {
    const data = await purchasesService.getById(req.params.id);
    return sendResponse(res, 200, 'Purchase order retrieved successfully', data);
  });

  update = catchAsync(async (req, res) => {
    const data = await purchasesService.update(req.params.id, req.body);
    return sendResponse(res, 200, 'Purchase order updated successfully', data);
  });

  delete = catchAsync(async (req, res) => {
    await purchasesService.delete(req.params.id);
    return sendResponse(res, 200, 'Purchase order deleted successfully');
  });

  updateStatus = catchAsync(async (req, res) => {
    const { status } = req.body;
    const data = await purchasesService.updateStatus(req.params.id, status);
    return sendResponse(res, 200, 'Purchase order status updated successfully', data);
  });

  receiveReceipt = catchAsync(async (req, res) => {
    const userId = req.user._id;
    const data = await purchasesService.receiveReceipt(req.params.id, req.body, userId);
    return sendResponse(res, 201, 'Goods received and receipt created successfully', data);
  });

  createPayment = catchAsync(async (req, res) => {
    const data = await purchasesService.createPayment(req.params.id, req.body);
    return sendResponse(res, 201, 'Purchase payment recorded successfully', data);
  });
}

export default new PurchasesController();
