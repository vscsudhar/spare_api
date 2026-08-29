import ordersService from './orders.service.js';
import sendResponse from '../../utils/response.js';
import catchAsync from '../../utils/catchAsync.js';

export class OrdersController {
  validateCheckout = catchAsync(async (req, res) => {
    const { addressId } = req.body;
    const data = await ordersService.validateCheckout(req.user._id, addressId);
    return sendResponse(res, 200, 'Checkout calculations validated successfully', data);
  });

  createOrder = catchAsync(async (req, res) => {
    // Read Idempotency Key from custom headers or body payload
    const idempotencyKey = req.headers['x-idempotency-key'] || req.body.idempotencyKey || null;

    const data = await ordersService.createOrder(req.user._id, req.body, idempotencyKey);
    return sendResponse(res, 201, 'Order created successfully', data);
  });

  getMyOrders = catchAsync(async (req, res) => {
    const data = await ordersService.getMyOrders(req.user._id);
    return sendResponse(res, 200, 'My orders retrieved successfully', data);
  });

  getMyOrderById = catchAsync(async (req, res) => {
    const data = await ordersService.getMyOrderById(req.user._id, req.params.id);
    return sendResponse(res, 200, 'Order details retrieved successfully', data);
  });

  cancelMyOrder = catchAsync(async (req, res) => {
    const data = await ordersService.cancelMyOrder(req.user._id, req.params.id);
    return sendResponse(res, 200, 'Order cancelled successfully', data);
  });

  // Admin order-management actions
  adminGetAll = catchAsync(async (req, res) => {
    const data = await ordersService.adminGetAll();
    return sendResponse(res, 200, 'All orders retrieved successfully', data);
  });

  adminGetById = catchAsync(async (req, res) => {
    const data = await ordersService.adminGetById(req.params.id);
    return sendResponse(res, 200, 'Order details retrieved successfully', data);
  });

  adminUpdateStatus = catchAsync(async (req, res) => {
    const { status, notes } = req.body;
    const data = await ordersService.adminUpdateStatus(req.params.id, status, notes, req.user._id);
    return sendResponse(res, 200, 'Order status updated successfully', data);
  });

  adminAssignDelivery = catchAsync(async (req, res) => {
    const { driverId, notes } = req.body;
    const data = await ordersService.adminAssignDelivery(req.params.id, driverId, notes);
    return sendResponse(res, 200, 'Delivery driver assigned successfully', data);
  });

  adminAddNote = catchAsync(async (req, res) => {
    const { text } = req.body;
    const data = await ordersService.adminAddNote(req.params.id, text, req.user._id);
    return sendResponse(res, 200, 'Admin note appended successfully', data);
  });
}

export default new OrdersController();
