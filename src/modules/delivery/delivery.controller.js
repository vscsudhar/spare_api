import deliveryService from './delivery.service.js';
import sendResponse from '../../utils/response.js';
import catchAsync from '../../utils/catchAsync.js';

export class DeliveryController {
  getDashboardSummary = catchAsync(async (req, res) => {
    const data = await deliveryService.getDashboardSummary(req.user._id, req.query);
    return sendResponse(res, 200, 'Delivery dashboard summary retrieved successfully', data);
  });

  getAssignedOrders = catchAsync(async (req, res) => {
    const data = await deliveryService.getAssignedOrders(req.user._id, req.query);
    return sendResponse(res, 200, 'Assigned orders retrieved successfully', data);
  });

  getOrderById = catchAsync(async (req, res) => {
    const data = await deliveryService.getOrderById(req.user._id, req.params.id);
    return sendResponse(res, 200, 'Order details retrieved successfully', data);
  });

  updateDeliveryStatus = catchAsync(async (req, res) => {
    const data = await deliveryService.updateDeliveryStatus(
      req.user._id,
      req.params.id,
      req.body
    );
    return sendResponse(res, 200, 'Delivery status updated successfully', data);
  });

  collectPayment = catchAsync(async (req, res) => {
    const data = await deliveryService.collectPayment(
      req.user._id,
      req.params.id,
      req.body
    );
    return sendResponse(res, 200, 'Payment collected and recorded successfully', data);
  });

  getCollections = catchAsync(async (req, res) => {
    const data = await deliveryService.getCollections(req.user._id, req.query);
    return sendResponse(res, 200, 'Collection history retrieved successfully', data);
  });
}

export default new DeliveryController();
