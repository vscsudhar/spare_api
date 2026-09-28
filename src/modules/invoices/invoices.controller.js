import invoicesService from './invoices.service.js';
import sendResponse from '../../utils/response.js';
import catchAsync from '../../utils/catchAsync.js';

export class InvoicesController {
  getOrderInvoice = catchAsync(async (req, res) => {
    const orderId = req.params.orderId || req.params.id;
    const data = await invoicesService.getOrCreateInvoiceForOrder(
      orderId,
      req.user._id,
      req.user.role,
      req.isOwner
    );
    return sendResponse(res, 200, 'Invoice retrieved successfully', data);
  });

  createOrderInvoice = catchAsync(async (req, res) => {
    const orderId = req.params.orderId || req.params.id;
    const data = await invoicesService.getOrCreateInvoiceForOrder(
      orderId,
      req.user._id,
      req.user.role,
      req.isOwner
    );
    return sendResponse(res, 200, 'Invoice created or retrieved successfully', data);
  });

  getInvoiceById = catchAsync(async (req, res) => {
    const data = await invoicesService.getInvoiceById(
      req.params.id,
      req.user._id,
      req.user.role,
      req.isOwner
    );
    return sendResponse(res, 200, 'Invoice details retrieved successfully', data);
  });

  getAllInvoices = catchAsync(async (req, res) => {
    const data = await invoicesService.getAllInvoices(req.query);
    return sendResponse(res, 200, 'Invoices retrieved successfully', data);
  });
}

export default new InvoicesController();
