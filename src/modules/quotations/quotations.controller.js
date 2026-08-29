import quotationsService from './quotations.service.js';
import sendResponse from '../../utils/response.js';
import catchAsync from '../../utils/catchAsync.js';

export class QuotationsController {
  getAll = catchAsync(async (req, res) => {
    const data = await quotationsService.getAll();
    return sendResponse(res, 200, 'Quotations retrieved successfully', data);
  });
}

export default new QuotationsController();
