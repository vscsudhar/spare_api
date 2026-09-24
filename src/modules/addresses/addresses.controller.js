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
    const message = data.serviceAvailable === false && data.latitude
      ? 'Address saved, but no service hub is available nearby'
      : 'Address saved successfully';
    return sendResponse(res, 201, message, data);
  });

  update = catchAsync(async (req, res) => {
    const data = await addressesService.update(req.user._id, req.params.id, req.body);
    const message = data.serviceAvailable === false && data.latitude
      ? 'Address saved, but no service hub is available nearby'
      : 'Address updated successfully';
    return sendResponse(res, 200, message, data);
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
