import locationsService from './locations.service.js';
import sendResponse from '../../utils/response.js';
import catchAsync from '../../utils/catchAsync.js';

export class LocationsController {
  getAll = catchAsync(async (req, res) => {
    const data = await locationsService.getAll(req.query);
    return sendResponse(res, 200, 'Locations retrieved successfully', data);
  });

  getById = catchAsync(async (req, res) => {
    const data = await locationsService.getById(req.params.id);
    return sendResponse(res, 200, 'Location retrieved successfully', data);
  });

  create = catchAsync(async (req, res) => {
    const data = await locationsService.create(req.body);
    return sendResponse(res, 201, 'Location created successfully', data);
  });

  update = catchAsync(async (req, res) => {
    const data = await locationsService.update(req.params.id, req.body);
    return sendResponse(res, 200, 'Location updated successfully', data);
  });

  delete = catchAsync(async (req, res) => {
    await locationsService.delete(req.params.id);
    return sendResponse(res, 200, 'Location deleted successfully');
  });

  getInventory = catchAsync(async (req, res) => {
    const data = await locationsService.getLocationInventory(req.params.locationId, req.query);
    return sendResponse(res, 200, 'Location inventory retrieved successfully', data);
  });

  updateInventory = catchAsync(async (req, res) => {
    const { locationId, productId } = req.params;
    const { quantity } = req.body;
    const data = await locationsService.updateInventoryStock(locationId, productId, quantity);
    return sendResponse(res, 200, 'Location stock updated successfully', data);
  });

  deleteInventory = catchAsync(async (req, res) => {
    const { locationId, productId } = req.params;
    await locationsService.deleteInventoryRecord(locationId, productId);
    return sendResponse(res, 200, 'Location inventory record removed successfully');
  });
}

export default new LocationsController();
