import Notifications from './notifications.model.js';
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

    return notification;
  },

  /**
   * List user notifications
   */
  getAllForUser: async (userId, isAdmin = false) => {
    const query = isAdmin ? { $or: [{ user: userId }, { user: null }] } : { user: userId };
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
    const query = isAdmin
      ? { _id: id, $or: [{ user: userId }, { user: null }] }
      : { _id: id, user: userId };

    const notification = await Notifications.findOneAndUpdate(query, { read: true }, { new: true });
    if (!notification) {
      throw new AppError('Notification not found or access denied.', 404);
    }
    return notification;
  },

  /**
   * Mark all notifications as read
   */
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
    const query = isAdmin
      ? { _id: id, $or: [{ user: userId }, { user: null }] }
      : { _id: id, user: userId };

    const deleted = await Notifications.findOneAndDelete(query);
    if (!deleted) {
      throw new AppError('Notification not found or access denied.', 404);
    }
  },
};

export default notificationsService;
