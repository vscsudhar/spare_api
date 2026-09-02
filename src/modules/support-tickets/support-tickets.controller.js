import catchAsync from '../../utils/catchAsync.js';
import supportTicketsService from './support-tickets.service.js';

export const supportTicketsController = {
  createTicket: catchAsync(async (req, res) => {
    const photoUrls = [];
    if (req.files && Array.isArray(req.files)) {
      req.files.forEach(file => {
        photoUrls.push(`/uploads/${file.filename}`);
      });
    }
    if (req.body.photos && Array.isArray(req.body.photos)) {
      req.body.photos.forEach(p => {
        if (typeof p === 'string') photoUrls.push(p);
      });
    }

    const ticket = await supportTicketsService.createTicket(req.user._id, req.body, photoUrls);
    res.status(201).json({
      success: true,
      message: 'Support ticket created successfully',
      data: ticket,
    });
  }),

  getMyTickets: catchAsync(async (req, res) => {
    const tickets = await supportTicketsService.getMyTickets(req.user._id, req.query);
    res.status(200).json({
      success: true,
      message: 'Support tickets retrieved successfully',
      data: tickets,
    });
  }),

  getTicketById: catchAsync(async (req, res) => {
    const roleName = req.user?.role?.name || (typeof req.user?.role === 'string' ? req.user.role : '');
    const isAdmin = Boolean(
      req.isOwner ||
      ['admin', 'staff', 'superadmin', 'owner'].includes(roleName) ||
      (req.permissions && req.permissions.includes('staff.manage'))
    );
    const data = await supportTicketsService.getTicketById(req.params.id, req.user._id, isAdmin);
    res.status(200).json({
      success: true,
      message: 'Support ticket retrieved successfully',
      data,
    });
  }),

  sendMessage: catchAsync(async (req, res) => {
    const roleName = req.user?.role?.name || (typeof req.user?.role === 'string' ? req.user.role : '');
    const isAdmin = Boolean(
      req.isOwner ||
      ['admin', 'staff', 'superadmin', 'owner'].includes(roleName) ||
      (req.permissions && req.permissions.includes('staff.manage'))
    );
    const attachmentUrls = [];
    if (req.files && Array.isArray(req.files)) {
      req.files.forEach(file => {
        attachmentUrls.push(`/uploads/${file.filename}`);
      });
    }
    if (req.body.attachments && Array.isArray(req.body.attachments)) {
      req.body.attachments.forEach(a => {
        if (typeof a === 'string') attachmentUrls.push(a);
      });
    }

    const message = await supportTicketsService.sendMessage(
      req.params.id,
      req.user._id,
      req.body.message,
      attachmentUrls,
      isAdmin
    );
    res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      data: message,
    });
  }),

  updateStatus: catchAsync(async (req, res) => {
    const roleName = req.user?.role?.name || (typeof req.user?.role === 'string' ? req.user.role : '');
    const isAdmin = Boolean(
      req.isOwner ||
      ['admin', 'staff', 'superadmin', 'owner'].includes(roleName) ||
      (req.permissions && req.permissions.includes('staff.manage'))
    );
    const ticket = await supportTicketsService.updateStatus(
      req.params.id,
      req.body.status,
      req.user._id,
      isAdmin
    );
    res.status(200).json({
      success: true,
      message: 'Ticket status updated successfully',
      data: ticket,
    });
  }),

  adminGetAll: catchAsync(async (req, res) => {
    const data = await supportTicketsService.adminGetAll(req.query);
    res.status(200).json({
      success: true,
      message: 'Admin support tickets retrieved successfully',
      data: data.tickets,
      pagination: data.pagination,
    });
  }),
};

export default supportTicketsController;
