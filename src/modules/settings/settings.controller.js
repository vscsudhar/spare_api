import settingsService from './settings.service.js';
import sendResponse from '../../utils/response.js';
import catchAsync from '../../utils/catchAsync.js';

export class SettingsController {
  getSettings = catchAsync(async (req, res) => {
    const data = await settingsService.getSettings();
    return sendResponse(res, 200, 'Global settings retrieved successfully', data);
  });

  updateGeneral = catchAsync(async (req, res) => {
    const data = await settingsService.updateSection('general', req.body);
    return sendResponse(res, 200, 'General settings updated successfully', data);
  });

  updateBilling = catchAsync(async (req, res) => {
    const data = await settingsService.updateSection('billing', req.body);
    return sendResponse(res, 200, 'Billing settings updated successfully', data);
  });

  updatePos = catchAsync(async (req, res) => {
    const data = await settingsService.updateSection('pos', req.body);
    return sendResponse(res, 200, 'POS settings updated successfully', data);
  });

  updateInventory = catchAsync(async (req, res) => {
    const data = await settingsService.updateSection('inventory', req.body);
    return sendResponse(res, 200, 'Inventory settings updated successfully', data);
  });

  updateNotifications = catchAsync(async (req, res) => {
    const data = await settingsService.updateSection('notifications', req.body);
    return sendResponse(res, 200, 'Notification settings updated successfully', data);
  });

  updateAppearance = catchAsync(async (req, res) => {
    const data = await settingsService.updateSection('appearance', req.body);
    return sendResponse(res, 200, 'Appearance settings updated successfully', data);
  });

  updateSecurity = catchAsync(async (req, res) => {
    const data = await settingsService.updateSection('security', req.body);
    return sendResponse(res, 200, 'Security settings updated successfully', data);
  });

  uploadLogo = catchAsync(async (req, res) => {
    const data = await settingsService.uploadLogo(req.file);
    return sendResponse(res, 200, 'Brand logo uploaded successfully', data);
  });
}

export default new SettingsController();
