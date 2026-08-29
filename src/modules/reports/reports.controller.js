import reportsService from './reports.service.js';
import sendResponse from '../../utils/response.js';
import catchAsync from '../../utils/catchAsync.js';

export class ReportsController {
  getSales = catchAsync(async (req, res) => {
    const data = await reportsService.getSales(req.query);
    return sendResponse(res, 200, 'Sales report retrieved successfully', data);
  });

  getOrders = catchAsync(async (req, res) => {
    const data = await reportsService.getOrders(req.query);
    return sendResponse(res, 200, 'Orders report retrieved successfully', data);
  });

  getProducts = catchAsync(async (req, res) => {
    const data = await reportsService.getProducts(req.query);
    return sendResponse(res, 200, 'Products report retrieved successfully', data);
  });

  getInventory = catchAsync(async (req, res) => {
    const data = await reportsService.getInventory();
    return sendResponse(res, 200, 'Inventory report retrieved successfully', data);
  });

  getCustomers = catchAsync(async (req, res) => {
    const data = await reportsService.getCustomers(req.query);
    return sendResponse(res, 200, 'Customers report retrieved successfully', data);
  });

  getSuppliers = catchAsync(async (req, res) => {
    const data = await reportsService.getSuppliers();
    return sendResponse(res, 200, 'Suppliers report retrieved successfully', data);
  });

  getPurchases = catchAsync(async (req, res) => {
    const data = await reportsService.getPurchases(req.query);
    return sendResponse(res, 200, 'Purchases report retrieved successfully', data);
  });

  getPayments = catchAsync(async (req, res) => {
    const data = await reportsService.getPayments(req.query);
    return sendResponse(res, 200, 'Payments report retrieved successfully', data);
  });

  getRareRequests = catchAsync(async (req, res) => {
    const data = await reportsService.getRareRequests(req.query);
    return sendResponse(res, 200, 'Rare requests report retrieved successfully', data);
  });

  getEvVsPetrol = catchAsync(async (req, res) => {
    const data = await reportsService.getEvVsPetrol(req.query);
    return sendResponse(res, 200, 'EV vs Petrol report retrieved successfully', data);
  });

  exportCSV = catchAsync(async (req, res) => {
    const { type } = req.query;
    const csvData = await reportsService.exportToCSV(type || 'sales', req.query);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=report-${type || 'sales'}-${Date.now()}.csv`);
    return res.status(200).send(csvData);
  });

  getDashboardStats = catchAsync(async (req, res) => {
    const dashboardServiceModule = await import('../dashboard/dashboard.service.js');
    const data = await dashboardServiceModule.dashboardService.getSummary();
    return sendResponse(res, 200, 'Dashboard stats retrieved successfully', data);
  });
}

export default new ReportsController();
