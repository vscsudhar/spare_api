import Order from '../orders/orders.model.js';
import Products from '../products/products.model.js';
import Users from '../users/users.model.js';
import Supplier from '../suppliers/suppliers.model.js';
import RareProductRequest from '../rare-requests/rare-requests.model.js';
import Settings from '../settings/settings.model.js';

export const dashboardService = {
  /**
   * Get overall key metrics summary
   */
  getSummary: async () => {
    // 1. Total Revenue from non-cancelled orders
    const revenueAggregate = await Order.aggregate([
      { $match: { status: { $ne: 'cancelled' } } },
      { $group: { _id: null, total: { $sum: '$grandTotal' } } },
    ]);
    const revenue = revenueAggregate[0]?.total || 0;

    // 2. Total Orders
    const ordersCount = await Order.countDocuments({ status: { $ne: 'cancelled' } });

    // 3. Total Customers
    // Find customer role first
    const customerRole = await mongooseRole();
    const customersCount = await Users.countDocuments({ role: customerRole?._id });

    // 4. Total Products
    const productsCount = await Products.countDocuments({ isDeleted: { $ne: true } });

    return {
      revenue,
      orders: ordersCount,
      customers: customersCount,
      products: productsCount,
    };
  },

  /**
   * Get 10 most recent orders
   */
  getRecentOrders: async () => {
    return Order.find()
      .populate('user', 'name email')
      .sort({ createdAt: -1 })
      .limit(10);
  },

  /**
   * Get products with low stock levels
   */
  getLowStock: async () => {
    const settings = await Settings.findOne() || {};
    const threshold = settings.inventory?.lowStockThreshold ?? 10;

    return Products.find({
      currentStock: { $lt: threshold },
      isDeleted: { $ne: true },
    }).sort({ currentStock: 1 });
  },

  /**
   * Get Sales trend aggregation charts
   */
  getSalesChart: async (range = 'daily') => {
    let groupFormat = '%Y-%m-%d';
    if (range === 'weekly') {
      groupFormat = '%Y-%U'; // Year - Week Number
    } else if (range === 'monthly') {
      groupFormat = '%Y-%m';
    }

    const salesTrend = await Order.aggregate([
      { $match: { status: { $ne: 'cancelled' } } },
      {
        $group: {
          _id: { $dateToString: { format: groupFormat, date: '$createdAt' } },
          sales: { $sum: '$grandTotal' },
          ordersCount: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    return salesTrend.map((el) => ({
      period: el._id,
      sales: el.sales,
      orders: el.ordersCount,
    }));
  },

  /**
   * Get administrative quick statistics counts
   */
  getQuickStats: async () => {
    const settings = await Settings.findOne() || {};
    const threshold = settings.inventory?.lowStockThreshold ?? 10;

    // 1. Pending orders count
    const pendingOrders = await Order.countDocuments({ status: 'pending' });

    // 2. Low Stock products count
    const lowStock = await Products.countDocuments({
      currentStock: { $lt: threshold },
      isDeleted: { $ne: true },
    });

    // 3. Pending Sourcing Requests count
    const pendingRare = await RareProductRequest.countDocuments({
      status: { $in: ['submitted', 'searching'] },
    });

    // 4. Supplier payable dues sum
    const duesAggregate = await Supplier.aggregate([
      { $group: { _id: null, total: { $sum: '$outstandingBalance' } } },
    ]);
    const supplierDues = duesAggregate[0]?.total || 0;

    return {
      pendingOrders,
      lowStock,
      pendingRareRequests: pendingRare,
      supplierDues,
    };
  },
};

// Internal helper to get Customer Role ID
async function mongooseRole() {
  const RoleModel = mongooseRoleModel();
  return RoleModel.findOne({ name: 'customer' });
}

function mongooseRoleModel() {
  const mongoose = importMongooseSync();
  return mongoose.models.Role || mongoose.model('Role', new mongoose.Schema({ name: String }));
}

function importMongooseSync() {
  // Sync wrapper import helper
  const mongoose = requireMongoose();
  return mongoose;
}

import mongoose from 'mongoose';
const requireMongoose = () => mongoose;

export default dashboardService;
