import mongoose from 'mongoose';
import AppError from '../../errors/AppError.js';
import Order from '../orders/orders.model.js';
import Users from '../users/users.model.js';
import Role from '../users/roles.model.js';
import DeliveryPayment from './delivery.model.js';
import notificationsService from '../notifications/notifications.service.js';
import fcmService from '../notifications/fcm.service.js';

/**
 * Helper to compute precise local business date ranges
 */
const getDateRange = (period = 'daily', dateStr, startDateStr, endDateStr) => {
  const now = new Date();
  let baseDate = now;

  if (dateStr) {
    const parts = dateStr.split('-').map(Number);
    if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
      baseDate = new Date(parts[0], parts[1] - 1, parts[2]);
    }
  }

  const y = baseDate.getFullYear();
  const m = baseDate.getMonth();
  const d = baseDate.getDate();

  let start = new Date(y, m, d, 0, 0, 0, 0);
  let end = new Date(y, m, d, 23, 59, 59, 999);

  if (period === 'weekly') {
    const dayOfWeek = baseDate.getDay(); // 0 (Sun) to 6 (Sat)
    const diffToMonday = (dayOfWeek === 0 ? -6 : 1) - dayOfWeek;
    start = new Date(y, m, d + diffToMonday, 0, 0, 0, 0);
    end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
  } else if (period === 'monthly') {
    start = new Date(y, m, 1, 0, 0, 0, 0);
    end = new Date(y, m + 1, 0, 23, 59, 59, 999);
  } else if (period === 'custom' && startDateStr) {
    const sParts = startDateStr.split('-').map(Number);
    start = new Date(sParts[0], sParts[1] - 1, sParts[2], 0, 0, 0, 0);

    if (endDateStr) {
      const eParts = endDateStr.split('-').map(Number);
      end = new Date(eParts[0], eParts[1] - 1, eParts[2], 23, 59, 59, 999);
    } else {
      end = new Date(sParts[0], sParts[1] - 1, sParts[2], 23, 59, 59, 999);
    }
  }

  return { start, end };
};

/**
 * Helper to resolve driver ID aliases (e.g. sudhar accounts, owner/admin test logins)
 */
const resolveDriverIds = async (driverId) => {
  const driverIds = [new mongoose.Types.ObjectId(driverId)];
  try {
    const user = await Users.findById(driverId).populate('role');
    if (user) {
      const emailLower = (user.email || '').toLowerCase();
      const isSudhar =
        emailLower === 'sudhar@mail.com' ||
        emailLower === 'vscsudhar@gmail.com' ||
        (user.name && user.name.toLowerCase().includes('sudhar'));

      if (isSudhar) {
        const linkedUsers = await Users.find({
          $or: [
            { email: { $in: ['sudhar@mail.com', 'vscsudhar@gmail.com'] } },
            { name: /sudhar/i },
          ],
        }).select('_id');
        linkedUsers.forEach((u) => {
          if (!driverIds.some((id) => id.equals(u._id))) {
            driverIds.push(u._id);
          }
        });
      } else if (['owner', 'admin'].includes(user.role?.name)) {
        // Owners / admins testing delivery app can see all driver assignments
        const allDrivers = await Users.find().select('_id');
        allDrivers.forEach((u) => {
          if (!driverIds.some((id) => id.equals(u._id))) {
            driverIds.push(u._id);
          }
        });
      }
    }
  } catch (err) {
    console.error('Error resolving driver IDs:', err);
  }
  return driverIds;
};

export const deliveryService = {
  /**
   * Get Dashboard Metrics for Delivery Partner
   */
  getDashboardSummary: async (driverId, query = {}) => {
    const { period = 'daily', date, startDate, endDate } = query;
    const { start, end } = getDateRange(period, date, startDate, endDate);

    const driverIds = await resolveDriverIds(driverId);

    // 1. Open Deliveries: Orders assigned to this partner that are not completed (delivered) or cancelled
    const openDeliveries = await Order.countDocuments({
      'deliveryAssignment.driver': { $in: driverIds },
      status: { $nin: ['delivered', 'cancelled', 'returned'] },
    });

    // 2. Completed Deliveries: Orders delivered within the selected period
    const completedDeliveries = await Order.countDocuments({
      'deliveryAssignment.driver': { $in: driverIds },
      status: 'delivered',
      $or: [
        { 'deliveryAssignment.deliveredAt': { $gte: start, $lte: end } },
        { updatedAt: { $gte: start, $lte: end } },
      ],
    });

    // 3. Pending Deliveries: Assigned orders still awaiting action/delivery
    const pendingDeliveries = await Order.countDocuments({
      'deliveryAssignment.driver': { $in: driverIds },
      status: {
        $in: [
          'pending',
          'confirmed',
          'processing',
          'packed',
          'shipped',
          'in_transit',
          'out_for_delivery',
          'delivery_later',
        ],
      },
    });

    // 4. Collected Amount: Confirmed COD payment collections within selected date range
    const collectionsAggregate = await DeliveryPayment.aggregate([
      {
        $match: {
          driver: { $in: driverIds },
          status: 'collected',
          collectedAt: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
    ]);

    const collectedAmount = collectionsAggregate[0]?.totalAmount || 0;
    const collectedCount = collectionsAggregate[0]?.count || 0;

    return {
      openDeliveries,
      completedDeliveries,
      pendingDeliveries,
      collectedAmount,
      collectedCount,
      dateRange: {
        period,
        startDate: start.toISOString(),
        endDate: end.toISOString(),
      },
    };
  },

  /**
   * Get Assigned Orders for logged-in delivery partner
   */
  getAssignedOrders: async (driverId, query = {}) => {
    const { status, period, date, startDate, endDate, page = 1, limit = 20 } = query;
    const driverIds = await resolveDriverIds(driverId);

    const filter = {
      'deliveryAssignment.driver': { $in: driverIds },
    };

    // Filter by status category or exact status
    if (status) {
      if (status === 'open') {
        filter.status = { $nin: ['delivered', 'cancelled', 'returned'] };
      } else if (status === 'completed') {
        filter.status = 'delivered';
      } else if (status === 'pending') {
        filter.status = {
          $in: [
            'pending',
            'confirmed',
            'processing',
            'packed',
            'shipped',
            'in_transit',
            'out_for_delivery',
            'delivery_later',
          ],
        };
      } else {
        filter.status = status;
      }
    }

    // Optional date filter:
    // Only completed deliveries are filtered by completion date range.
    // Active/open assigned deliveries MUST always be visible to the driver regardless of order creation date!
    if (status === 'completed') {
      const { start, end } = getDateRange(period || 'daily', date, startDate, endDate);
      filter.$or = [
        { 'deliveryAssignment.deliveredAt': { $gte: start, $lte: end } },
        { updatedAt: { $gte: start, $lte: end } },
      ];
    } else if (query.filterByDate === 'true') {
      const { start, end } = getDateRange(period || 'daily', date, startDate, endDate);
      filter.$or = [
        { 'deliveryAssignment.assignedAt': { $gte: start, $lte: end } },
        { createdAt: { $gte: start, $lte: end } },
      ];
    }

    const skip = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);
    const take = parseInt(limit, 10);

    const [orders, total] = await Promise.all([
      Order.find(filter)
        .populate('user', 'name email phone')
        .populate('deliveryAssignment.driver', 'name email phone')
        .populate('items.product', 'name images sku sellingPrice mrp')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(take),
      Order.countDocuments(filter),
    ]);

    return {
      orders,
      total,
      page: parseInt(page, 10),
      totalPages: Math.ceil(total / take) || 1,
    };
  },

  /**
   * Get single order details with assignment security check
   */
  getOrderById: async (driverId, orderId) => {
    const order = await Order.findById(orderId)
      .populate('user', 'name email phone')
      .populate('deliveryAssignment.driver', 'name email phone')
      .populate('items.product', 'name images sku sellingPrice mrp');

    if (!order) {
      throw new AppError('Order not found.', 404);
    }

    const driverIds = await resolveDriverIds(driverId);
    const assignedDriverId = order.deliveryAssignment?.driver?._id || order.deliveryAssignment?.driver;
    const isAuthorized =
      order.deliveryAssignment &&
      assignedDriverId &&
      driverIds.some((id) => id.equals(assignedDriverId));

    if (!isAuthorized) {
      throw new AppError('Unauthorized: This order is not assigned to you.', 403);
    }

    return order;
  },

  /**
   * Update Delivery Status with validation and audit trail
   */
  updateDeliveryStatus: async (driverId, orderId, updateData) => {
    const { status, notes = '', rescheduledDate } = updateData;

    const order = await Order.findById(orderId).populate('deliveryAssignment.driver');
    if (!order) {
      throw new AppError('Order not found.', 404);
    }

    const driverIds = await resolveDriverIds(driverId);
    const assignedDriverId = order.deliveryAssignment?.driver?._id || order.deliveryAssignment?.driver;
    const isAuthorized =
      order.deliveryAssignment &&
      assignedDriverId &&
      driverIds.some((id) => id.equals(assignedDriverId));

    if (!isAuthorized) {
      throw new AppError('Unauthorized: This order is not assigned to you.', 403);
    }

    // Business rule: If setting to 'delivered', COD orders must be paid
    const isCod =
      order.paymentMethod?.toLowerCase().includes('cash') ||
      order.paymentMethod?.toLowerCase().includes('cod');

    if (status === 'delivered') {
      if (isCod && order.paymentStatus !== 'paid') {
        throw new AppError(
          'Cannot complete delivery. COD payment must be collected first.',
          400
        );
      }
      order.deliveryAssignment.status = 'delivered';
      order.deliveryAssignment.deliveredAt = new Date();
    } else if (status === 'in_transit' || status === 'out_for_delivery') {
      order.deliveryAssignment.status = 'picked_up';
      if (!order.deliveryAssignment.pickedUpAt) {
        order.deliveryAssignment.pickedUpAt = new Date();
      }
    } else if (status === 'delivery_later') {
      order.deliveryAssignment.status = 'assigned';
    } else if (status === 'cancelled') {
      order.deliveryAssignment.status = 'failed';
    }

    order.status = status;
    const historyNote =
      notes ||
      (status === 'delivery_later' && rescheduledDate
        ? `Delivery rescheduled to ${rescheduledDate}`
        : `Status updated to ${status} by delivery partner`);

    order.statusHistory.push({
      status,
      changedBy: driverId,
      notes: historyNote,
      timestamp: new Date(),
    });

    if (notes) {
      order.deliveryAssignment.notes = notes;
    }

    await order.save();

    // Trigger notification to customer
    const deliveryStatusTitles = {
      in_transit: 'Order In Transit',
      out_for_delivery: 'Out for Delivery',
      delivered: 'Order Delivered',
      delivery_later: 'Delivery Rescheduled',
    };
    const deliveryStatusMessages = {
      in_transit: `Your order ${order.orderNumber} has been picked up and is in transit.`,
      out_for_delivery: `Your order ${order.orderNumber} is out for delivery.`,
      delivered: `Your order ${order.orderNumber} has been delivered successfully.`,
      delivery_later: `Your delivery for order ${order.orderNumber} has been rescheduled.`,
    };

    const dTitle = deliveryStatusTitles[status] || 'Order Status Update';
    const dMessage = deliveryStatusMessages[status] || `Your order ${order.orderNumber} is now "${status.replace(/_/g, ' ')}".`;

    try {
      await notificationsService.createNotification(order.user, {
        title: dTitle,
        message: dMessage,
        type: 'order_status',
        referenceId: order._id,
        referenceType: 'Order',
      });
      await fcmService.sendToUser(order.user, {
        title: dTitle,
        body: dMessage,
        data: {
          type: 'order_status',
          orderId: order._id.toString(),
          orderNumber: order.orderNumber,
          status,
        },
      });
    } catch (e) {
      console.error('Notification error:', e);
    }

    return order;
  },

  /**
   * Collect COD Payment atomically and idempotently
   */
  collectPayment: async (driverId, orderId, paymentData = {}) => {
    const {
      paymentMethod = 'Cash on Delivery',
      notes = '',
      transactionReference = '',
    } = paymentData;

    const order = await Order.findById(orderId).populate('deliveryAssignment.driver');
    if (!order) {
      throw new AppError('Order not found.', 404);
    }

    const driverIds = await resolveDriverIds(driverId);
    const assignedDriverId = order.deliveryAssignment?.driver?._id || order.deliveryAssignment?.driver;
    const isAuthorized =
      order.deliveryAssignment &&
      assignedDriverId &&
      driverIds.some((id) => id.equals(assignedDriverId));

    if (!isAuthorized) {
      throw new AppError('Unauthorized: This order is not assigned to you.', 403);
    }

    if (order.paymentStatus === 'paid') {
      throw new AppError('Payment has already been marked as paid for this order.', 400);
    }

    // Check for existing collection record to prevent duplicate submission
    const existingPayment = await DeliveryPayment.findOne({
      order: orderId,
      status: 'collected',
    });

    if (existingPayment) {
      order.paymentStatus = 'paid';
      await order.save();
      return { payment: existingPayment, order };
    }

    // Create payment collection transaction with trusted order total
    const payment = await DeliveryPayment.create({
      order: order._id,
      driver: driverId,
      amount: order.grandTotal,
      paymentMethod: paymentMethod || order.paymentMethod || 'Cash on Delivery',
      transactionReference,
      notes,
      status: 'collected',
      collectedAt: new Date(),
    });

    order.paymentStatus = 'paid';
    order.statusHistory.push({
      status: order.status,
      changedBy: driverId,
      notes: `COD Payment collected: ₹${(order.grandTotal / 100).toFixed(2)} (${paymentMethod})`,
      timestamp: new Date(),
    });

    await order.save();

    return { payment, order };
  },

  /**
   * Detailed Collection History for Delivery Partner
   */
  getCollections: async (driverId, query = {}) => {
    const { period = 'daily', date, startDate, endDate, page = 1, limit = 20 } = query;
    const { start, end } = getDateRange(period, date, startDate, endDate);

    const driverIds = await resolveDriverIds(driverId);
    const filter = {
      driver: { $in: driverIds },
      status: 'collected',
      collectedAt: { $gte: start, $lte: end },
    };

    const skip = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);
    const take = parseInt(limit, 10);

    const [collections, total, stats] = await Promise.all([
      DeliveryPayment.find(filter)
        .populate({
          path: 'order',
          select: 'orderNumber grandTotal paymentMethod shippingAddress user status',
          populate: { path: 'user', select: 'name phone email' },
        })
        .populate('driver', 'name phone email')
        .sort({ collectedAt: -1 })
        .skip(skip)
        .limit(take),
      DeliveryPayment.countDocuments(filter),
      DeliveryPayment.aggregate([
        { $match: filter },
        {
          $group: {
            _id: null,
            totalAmount: { $sum: '$amount' },
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    const totalCollectedAmount = stats[0]?.totalAmount || 0;
    const totalCollectionsCount = stats[0]?.count || 0;

    return {
      totalCollectedAmount,
      totalCollectionsCount,
      collections,
      page: parseInt(page, 10),
      totalPages: Math.ceil(total / take) || 1,
      dateRange: {
        period,
        startDate: start.toISOString(),
        endDate: end.toISOString(),
      },
    };
  },
};

export default deliveryService;
