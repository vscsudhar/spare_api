import rareRequestsService from './rare-requests.service.js';
import sendResponse from '../../utils/response.js';
import catchAsync from '../../utils/catchAsync.js';

export class RareRequestsController {
  createRequest = catchAsync(async (req, res) => {
    const data = await rareRequestsService.createRequest(req.user._id, req.body);
    return sendResponse(res, 201, 'Rare product request submitted successfully', data);
  });

  getMyRequests = catchAsync(async (req, res) => {
    const data = await rareRequestsService.getMyRequests(req.user._id);
    return sendResponse(res, 200, 'Requests retrieved successfully', data);
  });

  getRequestById = catchAsync(async (req, res) => {
    const data = await rareRequestsService.getRequestById(req.user._id, req.params.id);
    return sendResponse(res, 200, 'Request details retrieved successfully', data);
  });

  updateRequest = catchAsync(async (req, res) => {
    const data = await rareRequestsService.updateRequest(req.user._id, req.params.id, req.body);
    return sendResponse(res, 200, 'Request details updated successfully', data);
  });

  addRequestImages = catchAsync(async (req, res) => {
    const data = await rareRequestsService.addRequestImages(req.user._id, req.params.id, req.files || []);
    return sendResponse(res, 200, 'Images uploaded and attached successfully', data);
  });

  getChatMessages = catchAsync(async (req, res) => {
    const data = await rareRequestsService.getChatMessages(req.user._id, req.params.id);
    return sendResponse(res, 200, 'Chat messages retrieved successfully', data);
  });

  sendChatMessage = catchAsync(async (req, res) => {
    const { message } = req.body;
    const data = await rareRequestsService.sendChatMessage(req.user._id, req.params.id, message);
    return sendResponse(res, 201, 'Message sent successfully', data);
  });

  getQuotations = catchAsync(async (req, res) => {
    const data = await rareRequestsService.getQuotations(req.user._id, req.params.id);
    return sendResponse(res, 200, 'Quotations retrieved successfully', data);
  });

  approveQuotation = catchAsync(async (req, res) => {
    const data = await rareRequestsService.approveQuotation(req.user._id, req.params.id, req.params.quotationId);
    return sendResponse(res, 200, 'Quotation approved successfully', data);
  });

  cancelQuotation = catchAsync(async (req, res) => {
    const data = await rareRequestsService.cancelQuotation(req.user._id, req.params.id, req.params.quotationId);
    return sendResponse(res, 200, 'Quotation cancelled successfully', data);
  });

  reopenRequest = catchAsync(async (req, res) => {
    const data = await rareRequestsService.reopenRequest(req.user._id, req.params.id);
    return sendResponse(res, 200, 'Request reopened successfully', data);
  });

  // Admin Controller Handlers
  adminGetAll = catchAsync(async (req, res) => {
    const data = await rareRequestsService.adminGetAll();
    return sendResponse(res, 200, 'All rare product requests retrieved successfully', data);
  });

  adminGetById = catchAsync(async (req, res) => {
    const data = await rareRequestsService.adminGetById(req.params.id);
    return sendResponse(res, 200, 'Request details retrieved successfully', data);
  });

  adminUpdateStatus = catchAsync(async (req, res) => {
    const { status, notes } = req.body;
    const data = await rareRequestsService.adminUpdateStatus(req.params.id, status, notes, req.user._id);
    return sendResponse(res, 200, 'Request status updated successfully', data);
  });

  adminSendChatMessage = catchAsync(async (req, res) => {
    const { message } = req.body;
    const data = await rareRequestsService.sendChatMessage(req.user._id, req.params.id, message, true);
    return sendResponse(res, 201, 'Message sent successfully', data);
  });

  adminCreateQuotation = catchAsync(async (req, res) => {
    const data = await rareRequestsService.adminCreateQuotation(req.params.id, req.body, req.user._id);
    return sendResponse(res, 201, 'Quotation draft created successfully', data);
  });

  adminUpdateQuotation = catchAsync(async (req, res) => {
    const data = await rareRequestsService.adminUpdateQuotation(
      req.params.id,
      req.params.quotationId,
      req.body,
      req.user._id
    );
    return sendResponse(res, 200, 'Quotation revised successfully', data);
  });

  adminSendQuotation = catchAsync(async (req, res) => {
    const data = await rareRequestsService.adminSendQuotation(req.params.id, req.params.quotationId, req.user._id);
    return sendResponse(res, 200, 'Quotation sent successfully', data);
  });

  adminConvertToOrder = catchAsync(async (req, res) => {
    const { addressId } = req.body;
    const data = await rareRequestsService.adminConvertToOrder(req.params.id, addressId, req.user._id);
    return sendResponse(res, 201, 'Request converted to order successfully', data);
  });
}

export default new RareRequestsController();
