import Order from '../orders/orders.model.js';
import Products from '../products/products.model.js';
import Users from '../users/users.model.js';
import Supplier from '../suppliers/suppliers.model.js';
import PurchaseOrder from '../purchases/purchases.model.js';
import RareProductRequest from '../rare-requests/rare-requests.model.js';
import AppError from '../../errors/AppError.js';

// Date filter helper
const buildDateMatch = (startDate, endDate, dateField = 'createdAt') => {
  const match = {};
  if (startDate || endDate) {
    match[dateField] = {};
    if (startDate) match[dateField].$gte = new Date(startDate);
    if (endDate) match[dateField].$lte = new Date(endDate);
  }
  return match;
};

export const reportsService = {
  /**
   * Sales report
   */
  getSales: async (filters = {}) => {
    const { startDate, endDate, groupBy } = filters;
    const match = buildDateMatch(startDate, endDate);
    match.status = { $ne: 'cancelled' };

    let groupFormat = '%Y-%m-%d';
    if (groupBy === 'weekly') groupFormat = '%Y-%U';
    else if (groupBy === 'monthly') groupFormat = '%Y-%m';

    const pipeline = [
      { $match: match },
      {
        $group: {
          _id: { $dateToString: { format: groupFormat, date: '$createdAt' } },
          totalSales: { $sum: '$grandTotal' },
          subTotal: { $sum: '$subTotal' },
          taxAmount: { $sum: '$taxAmount' },
          deliveryFee: { $sum: '$deliveryFee' },
          ordersCount: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ];

    const results = await Order.aggregate(pipeline);
    return results.map((r) => ({
      period: r._id,
      totalSales: r.totalSales,
      subTotal: r.subTotal,
      taxAmount: r.taxAmount,
      deliveryFee: r.deliveryFee,
      ordersCount: r.ordersCount,
    }));
  },

  /**
   * Orders report
   */
  getOrders: async (filters = {}) => {
    const { startDate, endDate } = filters;
    const match = buildDateMatch(startDate, endDate);

    const pipeline = [
      { $match: match },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalValue: { $sum: '$grandTotal' },
        },
      },
    ];

    const results = await Order.aggregate(pipeline);
    return results.map((r) => ({
      status: r._id,
      count: r.count,
      totalValue: r.totalValue,
    }));
  },

  /**
   * Top Products report
   */
  getProducts: async (filters = {}) => {
    const { startDate, endDate } = filters;
    const match = buildDateMatch(startDate, endDate);
    match.status = { $ne: 'cancelled' };

    const pipeline = [
      { $match: match },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.product',
          productName: { $first: '$items.productSnapshot.name' },
          sku: { $first: '$items.productSnapshot.sku' },
          quantitySold: { $sum: '$items.quantity' },
          totalRevenue: { $sum: '$items.totalPrice' },
        },
      },
      { $sort: { quantitySold: -1 } },
      { $limit: 20 },
    ];

    const results = await Order.aggregate(pipeline);
    return results.map((r) => ({
      productId: r._id,
      name: r.productName,
      sku: r.sku,
      quantitySold: r.quantitySold,
      totalRevenue: r.totalRevenue,
    }));
  },

  /**
   * Inventory value report
   */
  getInventory: async () => {
    const pipeline = [
      { $match: { isDeleted: { $ne: true } } },
      {
        $group: {
          _id: null,
          totalProducts: { $sum: 1 },
          totalStock: { $sum: '$currentStock' },
          totalInventoryValue: { $sum: { $multiply: ['$currentStock', '$purchasePrice'] } },
        },
      },
    ];

    const results = await Products.aggregate(pipeline);
    return (
      results[0] || {
        totalProducts: 0,
        totalStock: 0,
        totalInventoryValue: 0,
      }
    );
  },

  /**
   * Customers report
   */
  getCustomers: async (filters = {}) => {
    const { startDate, endDate } = filters;
    const match = buildDateMatch(startDate, endDate);

    // Find customer role first
    const RoleModel = mongoose.models.Role || mongoose.model('Role');
    const customerRole = await RoleModel.findOne({ name: 'customer' });
    if (customerRole) {
      match.role = customerRole._id;
    }

    const pipeline = [
      { $match: match },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
          newCustomers: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ];

    const results = await Users.aggregate(pipeline);
    return results.map((r) => ({
      month: r._id,
      newCustomers: r.newCustomers,
    }));
  },

  /**
   * Suppliers report
   */
  getSuppliers: async () => {
    return Supplier.find({}, 'name companyName outstandingBalance email phone active').sort({
      outstandingBalance: -1,
    });
  },

  /**
   * Purchases report
   */
  getPurchases: async (filters = {}) => {
    const { startDate, endDate } = filters;
    const match = buildDateMatch(startDate, endDate);

    const pipeline = [
      { $match: match },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalCost: { $sum: '$grandTotal' },
        },
      },
    ];

    const results = await PurchaseOrder.aggregate(pipeline);
    return results.map((r) => ({
      status: r._id,
      count: r.count,
      totalCost: r.totalCost,
    }));
  },

  /**
   * Payments report
   */
  getPayments: async (filters = {}) => {
    const { startDate, endDate } = filters;
    const match = buildDateMatch(startDate, endDate);
    match.status = { $ne: 'cancelled' };

    const pipeline = [
      { $match: match },
      {
        $group: {
          _id: '$paymentMethod',
          count: { $sum: 1 },
          totalReceived: { $sum: '$grandTotal' },
        },
      },
    ];

    // Default POS maps to Orders payments
    const results = await Order.aggregate(pipeline);
    return results.map((r) => ({
      paymentMethod: r._id || 'unknown',
      count: r.count,
      totalReceived: r.totalReceived,
    }));
  },

  /**
   * Rare Requests report
   */
  getRareRequests: async (filters = {}) => {
    const { startDate, endDate } = filters;
    const match = buildDateMatch(startDate, endDate);

    const pipeline = [
      { $match: match },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ];

    const results = await RareProductRequest.aggregate(pipeline);
    return results.map((r) => ({
      status: r._id,
      count: r.count,
    }));
  },

  /**
   * EV vs Petrol sales report comparison
   */
  getEvVsPetrol: async (filters = {}) => {
    const { startDate, endDate } = filters;
    const match = buildDateMatch(startDate, endDate);
    match.status = { $ne: 'cancelled' };

    const pipeline = [
      { $match: match },
      { $unwind: '$items' },
      {
        $lookup: {
          from: 'products',
          localField: 'items.product',
          foreignField: '_id',
          as: 'productDetails',
        },
      },
      { $unwind: '$productDetails' },
      {
        $group: {
          _id: '$productDetails.vehicleType',
          quantitySold: { $sum: '$items.quantity' },
          totalRevenue: { $sum: '$items.totalPrice' },
        },
      },
    ];

    const results = await Order.aggregate(pipeline);
    return results.map((r) => ({
      vehicleType: r._id || 'Universal',
      quantitySold: r.quantitySold,
      totalRevenue: r.totalRevenue,
    }));
  },

  /**
   * Exports data to raw CSV format
   * @param {string} type - sales, orders, products, inventory, customers, suppliers, purchases, rare-requests
   * @param {object} filters - report query filters
   */
  exportToCSV: async (type, filters = {}) => {
    let data = [];
    switch (type) {
      case 'sales':
        data = await reportsService.getSales(filters);
        break;
      case 'orders':
        data = await reportsService.getOrders(filters);
        break;
      case 'products':
        data = await reportsService.getProducts(filters);
        break;
      case 'inventory':
        data = [await reportsService.getInventory()];
        break;
      case 'customers':
        data = await reportsService.getCustomers(filters);
        break;
      case 'suppliers':
        data = (await reportsService.getSuppliers()).map((s) => s.toObject ? s.toObject() : s);
        break;
      case 'purchases':
        data = await reportsService.getPurchases(filters);
        break;
      case 'rare-requests':
        data = await reportsService.getRareRequests(filters);
        break;
      default:
        throw new AppError(`Invalid report export type: ${type}`, 400);
    }

    if (data.length === 0) {
      return 'No data available for export';
    }

    const headers = Object.keys(data[0]);
    const csvRows = [headers.join(',')];

    for (const item of data) {
      const values = headers.map((header) => {
        const val = item[header];
        const stringVal = val === null || val === undefined ? '' : '' + val;
        // Escape quotes
        const escaped = stringVal.replace(/"/g, '\\"');
        return `"${escaped}"`;
      });
      csvRows.push(values.join(','));
    }

    return csvRows.join('\n');
  },
};

import mongoose from 'mongoose';

export default reportsService;
