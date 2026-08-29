import usersService from './users.service.js';
import sendResponse from '../../utils/response.js';
import catchAsync from '../../utils/catchAsync.js';

export class UsersController {
  getAllStaff = catchAsync(async (req, res) => {
    const data = await usersService.getAllStaff();
    return sendResponse(res, 200, 'Staff retrieved successfully', data);
  });

  createStaff = catchAsync(async (req, res) => {
    const data = await usersService.createStaff(req.body);
    return sendResponse(res, 201, 'Staff user created successfully', data);
  });

  getStaffById = catchAsync(async (req, res) => {
    const data = await usersService.getStaffById(req.params.id);
    return sendResponse(res, 200, 'Staff user retrieved successfully', data);
  });

  updateStaff = catchAsync(async (req, res) => {
    const data = await usersService.updateStaff(req.params.id, req.body);
    return sendResponse(res, 200, 'Staff user updated successfully', data);
  });

  updateStaffStatus = catchAsync(async (req, res) => {
    const { status } = req.body;
    const data = await usersService.updateStaffStatus(req.params.id, status);
    return sendResponse(res, 200, 'Staff status updated successfully', data);
  });

  updateStaffRole = catchAsync(async (req, res) => {
    const { role, permissions } = req.body;
    const data = await usersService.updateStaffRole(req.params.id, role, permissions);
    return sendResponse(res, 200, 'Staff role and permissions updated successfully', data);
  });

  deleteStaff = catchAsync(async (req, res) => {
    await usersService.deleteStaff(req.params.id);
    return sendResponse(res, 200, 'Staff user deleted successfully');
  });

  getAllRoles = catchAsync(async (req, res) => {
    const data = await usersService.getAllRoles();
    return sendResponse(res, 200, 'Roles retrieved successfully', data);
  });

  createRole = catchAsync(async (req, res) => {
    const data = await usersService.createRole(req.body);
    return sendResponse(res, 201, 'Role created successfully', data);
  });

  updateRole = catchAsync(async (req, res) => {
    const data = await usersService.updateRole(req.params.id, req.body);
    return sendResponse(res, 200, 'Role updated successfully', data);
  });

  getAllPermissions = catchAsync(async (req, res) => {
    const data = await usersService.getAllPermissions();
    return sendResponse(res, 200, 'Permissions retrieved successfully', data);
  });

  getProfile = catchAsync(async (req, res) => {
    const data = await usersService.getProfile(req.user._id);
    return sendResponse(res, 200, 'User profile retrieved successfully', data);
  });

  updateProfile = catchAsync(async (req, res) => {
    const data = await usersService.updateProfile(req.user._id, req.body);
    return sendResponse(res, 200, 'User profile updated successfully', data);
  });
}

export default new UsersController();
