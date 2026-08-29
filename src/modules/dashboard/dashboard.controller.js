import dashboardService from './dashboard.service.js';
import sendResponse from '../../utils/response.js';
import catchAsync from '../../utils/catchAsync.js';

export class DashboardController {
  getSummary = catchAsync(async (req, res) => {
    const data = await dashboardService.getSummary();
    return sendResponse(res, 200, 'Dashboard summary retrieved successfully', data);
  });

  getRecentOrders = catchAsync(async (req, res) => {
    const data = await dashboardService.getRecentOrders();
    return sendResponse(res, 200, 'Recent orders retrieved successfully', data);
  });

  getLowStock = catchAsync(async (req, res) => {
    const data = await dashboardService.getLowStock();
    return sendResponse(res, 200, 'Low stock products retrieved successfully', data);
  });

  getSalesChart = catchAsync(async (req, res) => {
    const { range } = req.query;
    const data = await dashboardService.getSalesChart(range || 'daily');
    return sendResponse(res, 200, 'Sales chart data retrieved successfully', data);
  });

  getQuickStats = catchAsync(async (req, res) => {
    const data = await dashboardService.getQuickStats();
    return sendResponse(res, 200, 'Quick stats retrieved successfully', data);
  });
}

export default new DashboardController();
