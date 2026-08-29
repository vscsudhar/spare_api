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
    return sendResponse(res, 200, 'Unread count retrieved successfully', { count });
  });

  markAsRead = catchAsync(async (req, res) => {
    const isAdmin = checkIsAdmin(req.user);
    const data = await notificationsService.markAsRead(req.params.id, req.user._id, isAdmin);
    return sendResponse(res, 200, 'Notification marked as read', data);
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
}

export default new NotificationsController();
