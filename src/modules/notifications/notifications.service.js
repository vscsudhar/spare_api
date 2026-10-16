import mongoose from 'mongoose';
import Notifications from './notifications.model.js';
import Users from '../users/users.model.js';
import Role from '../users/roles.model.js';
import DeviceToken from './deviceToken.model.js';
import fcmService from './fcm.service.js';
import AppError from '../../errors/AppError.js';

export const notificationsService = {
  /**
   * Helper to create a persistent notification and trigger real-time dispatch.
   */
  createNotification: async (userId, data) => {
    const notification = await Notifications.create({
      user: userId,
      ...data,
      read: false,
    });

    // Dispatch real-time web socket notice if socket server is initialized
    try {
      const { getIO } = await import('../../config/socket.js');
      const io = getIO();
      if (userId) {
        io.to(`user:${userId}`).emit('notification:new', notification);
      } else {
        io.to('admin:rare-requests').emit('notification:new', notification);
      }
    } catch (err) {
      // Ignored for environments without active WebSockets
    }

    // Dispatch Firebase Cloud Messaging push notification to user device
    if (userId) {
      try {
        await fcmService.sendToUser(userId, {
          title: data.title,
          body: data.message,
          image: data.image || null,
          data: {
            type: data.type || 'order_status',
            notificationId: notification._id.toString(),
            orderId: (data.type === 'order_status' && data.referenceId) ? data.referenceId.toString() : '',
            referenceId: data.referenceId ? data.referenceId.toString() : '',
            referenceType: data.referenceType || '',
          },
        });
      } catch (fcmErr) {
        console.warn('⚠️ [FCM] Notification push dispatch failed:', fcmErr.message);
      }
    }

    return notification;
  },

  /**
   * Send single manual/targeted notification to a specific customer
   */
  sendSingleNotification: async ({ customerId, title, message, image = null, type = 'manual_single', data = {}, sentBy = null }) => {
    const customer = await Users.findById(customerId).populate('role');
    if (!customer) {
      throw new AppError('Customer not found.', 404);
    }

    const notification = await notificationsService.createNotification(customerId, {
      title,
      message,
      image: image || null,
      type,
      sentBy: sentBy || null,
      targetAudience: 'individual',
      referenceId: customer._id,
      referenceType: 'Users',
    });

    // Send FCM push notification safely
    let fcmResult = { success: false, reason: 'Skipped' };
    try {
      fcmResult = await fcmService.sendToUser(customerId, {
        title,
        body: message,
        image: image || null,
        data: {
          type,
          notificationId: notification._id.toString(),
          ...data,
        },
      });
    } catch (fcmErr) {
      console.error('FCM sendToUser error:', fcmErr);
      fcmResult = { success: false, error: fcmErr.message };
    }

    return {
      notification,
      fcmResult,
    };
  },

  /**
   * Send bulk broadcast notification to all customers
   */
  sendBulkNotification: async ({ title, message, image = null, type = 'manual_bulk', targetAudience = 'all_customers', data = {}, sentBy = null }) => {
    const customerRole = await Role.findOne({ name: 'customer' });
    const userQuery = { isDeleted: { $ne: true } };
    if (targetAudience === 'active_customers') {
      userQuery.status = 'active';
    }
    if (customerRole) {
      userQuery.role = customerRole._id;
    }
    const customerUsers = await Users.find(userQuery).select('_id');

    // Also include any user who has an active customer app device token
    const customerAppTokens = await DeviceToken.find({ app: 'customer', isActive: true }).select('user');
    const customerAppUserIds = customerAppTokens
      .map((t) => t.user?.toString())
      .filter((uid) => uid && mongoose.Types.ObjectId.isValid(uid));

    const recipientSet = new Set([
      ...customerUsers.map((c) => c._id.toString()),
      ...customerAppUserIds,
    ]);
    const recipientIds = Array.from(recipientSet);

    // 1. Bulk insert notification records into MongoDB in chunks
    const chunkSize = 250;
    for (let i = 0; i < recipientIds.length; i += chunkSize) {
      const chunk = recipientIds.slice(i, i + chunkSize);
      const batchDocs = chunk.map((uid) => ({
        user: uid,
        title,
        message,
        image: image || null,
        type,
        sentBy: sentBy || null,
        targetAudience,
        read: false,
      }));
      if (batchDocs.length > 0) {
        await Notifications.insertMany(batchDocs, { ordered: false });
      }
    }

    // 2. Create master broadcast record for admin history log
    const masterBroadcast = await Notifications.create({
      user: null,
      title,
      message,
      image: image || null,
      type,
      sentBy: sentBy || null,
      targetAudience: 'broadcast_master',
      read: true,
    });

    // 3. Emit real-time WebSocket notice to active users
    try {
      const { getIO } = await import('../../config/socket.js');
      getIO().emit('notification:new', masterBroadcast);
    } catch (_) {}

    // 4. Dispatch Firebase Multicast Push Notification to all customer devices safely
    let fcmResult = { success: false, reason: 'Skipped' };
    try {
      fcmResult = await fcmService.sendToAllCustomers({
        title,
        body: message,
        image: image || null,
        data: {
          type,
          broadcastId: masterBroadcast._id.toString(),
          ...data,
        },
      });
    } catch (fcmErr) {
      console.error('FCM sendToAllCustomers error:', fcmErr);
      fcmResult = { success: false, error: fcmErr.message };
    }

    return {
      success: true,
      masterBroadcast,
      totalRecipients: recipientIds.length,
      fcmResult,
    };
  },

  /**
   * Admin: List all notifications history with pagination & filters
   */
  getAdminNotificationHistory: async ({ page = 1, limit = 20, type = null, search = '' }) => {
    const filter = {
      $or: [
        { targetAudience: 'broadcast_master' },
        { targetAudience: 'individual' },
        { user: null },
      ],
    };
    if (type && type !== 'all') {
      filter.type = type;
    }
    if (search && search.trim().length > 0) {
      filter.$or = [
        { title: { $regex: search.trim(), $options: 'i' } },
        { message: { $regex: search.trim(), $options: 'i' } },
      ];
    }

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.max(1, parseInt(limit, 10));
    const skip = (pageNum - 1) * limitNum;

    const [notifications, total] = await Promise.all([
      Notifications.find(filter)
        .populate('user', 'name email phone profileImage')
        .populate('sentBy', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      Notifications.countDocuments(filter),
    ]);

    return {
      notifications,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum) || 1,
      },
    };
  },

  /**
   * Admin: Quick search customers to select for single notification
   */
  getCustomersForNotification: async ({ search = '', limit = 20 }) => {
    const customerRole = await Role.findOne({ name: 'customer' });
    const query = { status: 'active', isDeleted: { $ne: true } };
    if (customerRole) {
      query.role = customerRole._id;
    }

    if (search && search.trim().length > 0) {
      const s = search.trim();
      query.$or = [
        { name: { $regex: s, $options: 'i' } },
        { email: { $regex: s, $options: 'i' } },
        { phone: { $regex: s, $options: 'i' } },
      ];
    }

    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10)));
    return Users.find(query).select('name email phone profileImage').limit(limitNum);
  },

  /**
   * List user notifications
   */
  getAllForUser: async (userId, isAdmin = false) => {
    const query = isAdmin
      ? { $or: [{ user: userId }, { user: null }] }
      : { user: userId };
    return Notifications.find(query).sort({ createdAt: -1 });
  },

  /**
   * Count unread notifications
   */
  getUnreadCount: async (userId, isAdmin = false) => {
    const query = isAdmin
      ? { $or: [{ user: userId }, { user: null }], read: false }
      : { user: userId, read: false };
    return Notifications.countDocuments(query);
  },

  /**
   * Mark specific notification as read
   */
  markAsRead: async (id, userId, isAdmin = false) => {
    const query = isAdmin ? { _id: id } : { _id: id, user: userId };

    const notification = await Notifications.findOneAndUpdate(query, { read: true }, { new: true });
    if (!notification) {
      throw new AppError('Notification not found or access denied.', 404);
    }
    return notification;
  },

  /**
   * Mark all notifications as read
   */
  
  /**
   * Mark specific notification as unread
   */
  markAsUnread: async (id, userId, isAdmin = false) => {
    let notification = await Notifications.findById(id);
    if (!notification) {
      throw new AppError('Notification not found.', 404);
    }
    notification.read = false;
    await notification.save();
    return notification;
  },

  /**
   * Batch mark notifications as read
   */
  batchMarkRead: async (ids, userId, isAdmin = false) => {
    const query = isAdmin ? { _id: { $in: ids } } : { _id: { $in: ids }, user: userId };
    await Notifications.updateMany(query, { read: true });
    return { success: true };
  },

  /**
   * Batch mark notifications as unread
   */
  batchMarkUnread: async (ids, userId, isAdmin = false) => {
    const query = isAdmin ? { _id: { $in: ids } } : { _id: { $in: ids }, user: userId };
    await Notifications.updateMany(query, { read: false });
    return { success: true };
  },

  /**
   * Batch delete notifications
   */
  batchDelete: async (ids, userId, isAdmin = false) => {
    const query = isAdmin ? { _id: { $in: ids } } : { _id: { $in: ids }, user: userId };
    await Notifications.deleteMany(query);
    return { success: true };
  },

  markAllAsRead: async (userId, isAdmin = false) => {
    const query = isAdmin
      ? { $or: [{ user: userId }, { user: null }], read: false }
      : { user: userId, read: false };

    await Notifications.updateMany(query, { read: true });
  },

  /**
   * Delete a notification
   */
  deleteNotification: async (id, userId, isAdmin = false) => {
    const query = isAdmin ? { _id: id } : { _id: id, user: userId };

    const deleted = await Notifications.findOneAndDelete(query);
    if (!deleted) {
      throw new AppError('Notification not found or access denied.', 404);
    }
  },
};

export default notificationsService;
