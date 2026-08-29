import billingService from './billing.service.js';
import sendResponse from '../../utils/response.js';
import catchAsync from '../../utils/catchAsync.js';

export class BillingController {
  getAll = catchAsync(async (req, res) => {
    const data = await billingService.getAll();
    return sendResponse(res, 200, 'Billing retrieved successfully', data);
  });

  preview = catchAsync(async (req, res) => {
    const { items, discountAmount, paymentAllocations } = req.body;
    const data = await billingService.preview(items || [], discountAmount || 0, paymentAllocations || []);
    return sendResponse(res, 200, 'POS preview calculated successfully', data);
  });

  checkout = catchAsync(async (req, res) => {
    const data = await billingService.checkout(req.user._id, req.body);
    return sendResponse(res, 201, 'POS billing checkout completed successfully', data);
  });
}

export default new BillingController();
