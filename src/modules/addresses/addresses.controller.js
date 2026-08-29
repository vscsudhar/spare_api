import addressesService from './addresses.service.js';
import sendResponse from '../../utils/response.js';
import catchAsync from '../../utils/catchAsync.js';

export class AddressesController {
  getAll = catchAsync(async (req, res) => {
    const data = await addressesService.getAllForUser(req.user._id);
    return sendResponse(res, 200, 'Addresses retrieved successfully', data);
  });

  create = catchAsync(async (req, res) => {
    const data = await addressesService.create(req.user._id, req.body);
    return sendResponse(res, 201, 'Address created successfully', data);
  });

  update = catchAsync(async (req, res) => {
    const data = await addressesService.update(req.user._id, req.params.id, req.body);
    return sendResponse(res, 200, 'Address updated successfully', data);
  });

  delete = catchAsync(async (req, res) => {
    await addressesService.delete(req.user._id, req.params.id);
    return sendResponse(res, 200, 'Address deleted successfully');
  });

  setDefault = catchAsync(async (req, res) => {
    const data = await addressesService.setDefault(req.user._id, req.params.id);
    return sendResponse(res, 200, 'Default address set successfully', data);
  });
}

export default new AddressesController();
