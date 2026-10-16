import fcmService from './fcm.service.js';
import notificationsService from './notifications.service.js';
import sendResponse from '../../utils/response.js';
import catchAsync from '../../utils/catchAsync.js';

const checkIsAdmin = (user) => {
  return ['owner', 'admin', 'inventory_staff', 'sales_staff', 'delivery_staff'].includes(user.role?.name);
};

export class NotificationsController {
  getAll = catchAsync(async (req, res) => {
    const isAdmin = checkIsAdmin(req.user);
    const data = await notificationsService.getAllForUser(req.user._id, isAdmin);
    return sendResponse(res, 200, 'Notifications retrieved successfully', data);
  });

  getUnreadCount = catchAsync(async (req, res) => {
    const isAdmin = checkIsAdmin(req.user);
    const count = await notificationsService.getUnreadCount(req.user._id, isAdmin);
    return sendResponse(res, 200, 'Unread count retrieved successfully', { count, unreadCount: count });
  });

  markAsRead = catchAsync(async (req, res) => {
    const isAdmin = checkIsAdmin(req.user);
    const data = await notificationsService.markAsRead(req.params.id, req.user._id, isAdmin);
    return sendResponse(res, 200, 'Notification marked as read', data);
  });

  
  markAsUnread = catchAsync(async (req, res) => {
    const isAdmin = checkIsAdmin(req.user);
    const data = await notificationsService.markAsUnread(req.params.id, req.user._id, isAdmin);
    return sendResponse(res, 200, 'Notification marked as unread', data);
  });

  batchMarkRead = catchAsync(async (req, res) => {
    const isAdmin = checkIsAdmin(req.user);
    await notificationsService.batchMarkRead(req.body.ids, req.user._id, isAdmin);
    return sendResponse(res, 200, 'Selected notifications marked as read', null);
  });

  batchMarkUnread = catchAsync(async (req, res) => {
    const isAdmin = checkIsAdmin(req.user);
    await notificationsService.batchMarkUnread(req.body.ids, req.user._id, isAdmin);
    return sendResponse(res, 200, 'Selected notifications marked as unread', null);
  });

  batchDelete = catchAsync(async (req, res) => {
    const isAdmin = checkIsAdmin(req.user);
    await notificationsService.batchDelete(req.body.ids, req.user._id, isAdmin);
    return sendResponse(res, 200, 'Selected notifications deleted successfully', null);
  });

  markAllAsRead = catchAsync(async (req, res) => {
    const isAdmin = checkIsAdmin(req.user);
    await notificationsService.markAllAsRead(req.user._id, isAdmin);
    return sendResponse(res, 200, 'All notifications marked as read', null);
  });

  delete = catchAsync(async (req, res) => {
    const isAdmin = checkIsAdmin(req.user);
    await notificationsService.deleteNotification(req.params.id, req.user._id, isAdmin);
    return sendResponse(res, 200, 'Notification deleted successfully', null);
  });

  registerDeviceToken = catchAsync(async (req, res) => {
    const { token, app, platform, deviceModel } = req.body;
    const roleName = req.user.role?.name || 'customer';
    const record = await fcmService.registerToken(req.user._id, {
      token,
      role: roleName,
      app,
      platform,
      deviceModel,
    });
    return sendResponse(res, 200, 'Device token registered successfully', record);
  });

  removeDeviceToken = catchAsync(async (req, res) => {
    const { token } = req.body;
    await fcmService.deactivateToken(req.user._id, token);
    return sendResponse(res, 200, 'Device token removed successfully', null);
  });

  /**
   * Admin: Send targeted notification to a single customer
   */
  sendSingle = catchAsync(async (req, res) => {
    if (!checkIsAdmin(req.user)) {
      throw new AppError('Access denied. Administrator privileges required.', 403);
    }
    const { customerId, title, message, image, type, data } = req.body;
    const result = await notificationsService.sendSingleNotification({
      customerId,
      title,
      message,
      image,
      type: type || 'manual_single',
      data: data || {},
      sentBy: req.user._id,
    });
    return sendResponse(res, 201, 'Notification dispatched successfully', result);
  });

  /**
   * Admin: Send broadcast notification to all customers
   */
  sendBulk = catchAsync(async (req, res) => {
    if (!checkIsAdmin(req.user)) {
      throw new AppError('Access denied. Administrator privileges required.', 403);
    }
    const { title, message, image, type, targetAudience, data } = req.body;
    const result = await notificationsService.sendBulkNotification({
      title,
      message,
      image,
      type: type || 'manual_bulk',
      targetAudience: targetAudience || 'all_customers',
      data: data || {},
      sentBy: req.user._id,
    });
    return sendResponse(res, 201, 'Bulk notification broadcast dispatched successfully', result);
  });

  /**
   * Admin: Get notification history logs with pagination
   */
  getAdminHistory = catchAsync(async (req, res) => {
    if (!checkIsAdmin(req.user)) {
      throw new AppError('Access denied. Administrator privileges required.', 403);
    }
    const result = await notificationsService.getAdminNotificationHistory(req.query);
    return sendResponse(res, 200, 'Notification history retrieved successfully', result);
  });

  /**
   * Admin: Search customer list for notification recipient picker
   */
  getCustomersList = catchAsync(async (req, res) => {
    if (!checkIsAdmin(req.user)) {
      throw new AppError('Access denied. Administrator privileges required.', 403);
    }
    const customers = await notificationsService.getCustomersForNotification(req.query);
    return sendResponse(res, 200, 'Customers list retrieved successfully', customers);
  });
}

export default new NotificationsController();
