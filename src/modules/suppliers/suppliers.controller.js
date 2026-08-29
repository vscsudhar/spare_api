import suppliersService from './suppliers.service.js';
import sendResponse from '../../utils/response.js';
import catchAsync from '../../utils/catchAsync.js';

export class SuppliersController {
  getAll = catchAsync(async (req, res) => {
    const data = await suppliersService.getAll();
    return sendResponse(res, 200, 'Suppliers retrieved successfully', data);
  });

  create = catchAsync(async (req, res) => {
    const data = await suppliersService.create(req.body);
    return sendResponse(res, 201, 'Supplier created successfully', data);
  });

  getById = catchAsync(async (req, res) => {
    const data = await suppliersService.getById(req.params.id);
    return sendResponse(res, 200, 'Supplier retrieved successfully', data);
  });

  update = catchAsync(async (req, res) => {
    const data = await suppliersService.update(req.params.id, req.body);
    return sendResponse(res, 200, 'Supplier updated successfully', data);
  });

  delete = catchAsync(async (req, res) => {
    await suppliersService.delete(req.params.id);
    return sendResponse(res, 200, 'Supplier deleted successfully');
  });

  updateStatus = catchAsync(async (req, res) => {
    const { status } = req.body;
    const data = await suppliersService.updateStatus(req.params.id, status);
    return sendResponse(res, 200, 'Supplier status updated successfully', data);
  });

  getProducts = catchAsync(async (req, res) => {
    const data = await suppliersService.getProducts(req.params.id);
    return sendResponse(res, 200, 'Supplier products retrieved successfully', data);
  });

  createProduct = catchAsync(async (req, res) => {
    const data = await suppliersService.createProduct(req.params.id, req.body);
    return sendResponse(res, 201, 'Supplier product mapping created successfully', data);
  });

  getPurchases = catchAsync(async (req, res) => {
    const data = await suppliersService.getPurchases(req.params.id);
    return sendResponse(res, 200, 'Supplier purchase orders retrieved successfully', data);
  });

  getPayments = catchAsync(async (req, res) => {
    const data = await suppliersService.getPayments(req.params.id);
    return sendResponse(res, 200, 'Supplier payments retrieved successfully', data);
  });

  createPayment = catchAsync(async (req, res) => {
    const data = await suppliersService.createPayment(req.params.id, req.body);
    return sendResponse(res, 201, 'Supplier payment logged successfully', data);
  });
}

export default new SuppliersController();
