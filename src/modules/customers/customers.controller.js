import customersService from './customers.service.js';
import sendResponse from '../../utils/response.js';
import catchAsync from '../../utils/catchAsync.js';

export class CustomersController {
  getMe = catchAsync(async (req, res) => {
    const data = await customersService.getMe(req.user._id);
    return sendResponse(res, 200, 'Profile details retrieved successfully', data);
  });

  updateMe = catchAsync(async (req, res) => {
    const data = await customersService.updateMe(req.user._id, req.body);
    return sendResponse(res, 200, 'Profile details updated successfully', data);
  });

  getAll = catchAsync(async (req, res) => {
    const data = await customersService.getAll();
    return sendResponse(res, 200, 'Customers retrieved successfully', data);
  });

  getById = catchAsync(async (req, res) => {
    const data = await customersService.getById(req.params.id);
    return sendResponse(res, 200, 'Customer details retrieved successfully', data);
  });

  updateStatus = catchAsync(async (req, res) => {
    const { status } = req.body;
    const data = await customersService.updateStatus(req.params.id, status);
    return sendResponse(res, 200, 'Customer status updated successfully', data);
  });

  getVehicles = catchAsync(async (req, res) => {
    const data = await customersService.getVehicles(req.user._id);
    return sendResponse(res, 200, 'Vehicles retrieved successfully', data);
  });

  addVehicle = catchAsync(async (req, res) => {
    const data = await customersService.addVehicle(req.user._id, req.body);
    return sendResponse(res, 201, 'Vehicle added successfully', data);
  });

  updateVehicle = catchAsync(async (req, res) => {
    const data = await customersService.updateVehicle(req.user._id, req.params.id, req.body);
    return sendResponse(res, 200, 'Vehicle updated successfully', data);
  });

  deleteVehicle = catchAsync(async (req, res) => {
    await customersService.deleteVehicle(req.user._id, req.params.id);
    return sendResponse(res, 200, 'Vehicle deleted successfully');
  });
}

export default new CustomersController();
