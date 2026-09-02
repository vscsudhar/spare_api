import mongoose from 'mongoose';
import AppError from '../../errors/AppError.js';
import { SupportTicket, SupportTicketMessage } from './support-tickets.model.js';
import notificationsService from '../notifications/notifications.service.js';

// Safe Socket.IO event emitter
const emitSocketEvent = async (room, event, payload) => {
  try {
    const { getIO } = await import('../../config/socket.js');
    getIO().to(room).emit(event, payload);
  } catch (err) {
    console.log(`[Socket.IO Fallback] Event ${event} to ${room} skipped`);
  }
};

export const supportTicketsService = {
  /**
   * Create a new support ticket (Customer)
   */
  createTicket: async (userId, data, photoUrls = []) => {
    const count = await SupportTicket.countDocuments();
    const ticketNumber = `TKT-${(1000 + count + 1).toString()}`;

    const photos = photoUrls.map(url => ({ url, uploadedAt: new Date() }));

    const ticket = await SupportTicket.create({
      ticketNumber,
      user: userId,
      subject: data.subject,
      category: data.category || 'General',
      description: data.description,
      priority: data.priority || 'medium',
      photos,
      status: 'open',
    });

    // Create initial message
    await SupportTicketMessage.create({
      ticket: ticket._id,
      sender: userId,
      senderRole: 'customer',
      message: data.description,
      attachments: photos,
      isRead: false,
    });

    const populatedTicket = await SupportTicket.findById(ticket._id).populate('user', 'name email phone profileImage');

    // Notify admins
    emitSocketEvent('admin:support-tickets', 'support_ticket:new', populatedTicket);

    try {
      await notificationsService.createNotification(null, {
        title: 'New Support Ticket',
        message: `Ticket #${ticketNumber}: ${data.subject}`,
        type: 'support_ticket_created',
        referenceId: ticket._id,
        referenceType: 'SupportTicket',
      });
    } catch (_) {}

    return populatedTicket;
  },

  /**
   * Get all tickets for logged-in user
   */
  getMyTickets: async (userId, query = {}) => {
    const filter = { user: userId };
    if (query.status && query.status !== 'all') {
      filter.status = query.status.toLowerCase();
    }

    const tickets = await SupportTicket.find(filter)
      .populate('user', 'name email phone profileImage')
      .sort({ updatedAt: -1 });

    return tickets;
  },

  /**
   * Get ticket details with full chat messages
   */
  getTicketById: async (ticketId, userId = null, isAdmin = false) => {
    const filter = {};
    if (mongoose.Types.ObjectId.isValid(ticketId)) {
      filter._id = ticketId;
    } else {
      filter.ticketNumber = ticketId;
    }
    if (!isAdmin && userId) {
      filter.user = userId;
    }

    const ticket = await SupportTicket.findOne(filter).populate('user', 'name email phone profileImage');
    if (!ticket) {
      throw new AppError('Support ticket not found', 404);
    }

    const messages = await SupportTicketMessage.find({ ticket: ticketId })
      .populate('sender', 'name email profileImage role')
      .sort({ createdAt: 1 });

    return {
      ticket,
      messages,
    };
  },

  /**
   * Send a chat message in a ticket
   */
  sendMessage: async (ticketId, userId, messageText, attachmentUrls = [], isAdmin = false) => {
    const filter = { _id: ticketId };
    if (!isAdmin) {
      filter.user = userId;
    }

    const ticket = await SupportTicket.findOne(filter);
    if (!ticket) {
      throw new AppError('Support ticket not found', 404);
    }

    const attachments = attachmentUrls.map(url => ({ url, uploadedAt: new Date() }));
    const senderRole = isAdmin ? 'admin' : 'customer';

    const message = await SupportTicketMessage.create({
      ticket: ticketId,
      sender: userId,
      senderRole,
      message: messageText,
      attachments,
      isRead: false,
    });

    // Update ticket state if needed
    if (isAdmin && ticket.status === 'open') {
      ticket.status = 'pending';
    } else if (!isAdmin && ticket.status === 'pending') {
      ticket.status = 'open';
    }
    ticket.updatedAt = new Date();
    await ticket.save();

    const populatedMsg = await SupportTicketMessage.findById(message._id).populate('sender', 'name email profileImage role');

    // Emit live events
    emitSocketEvent(`support-ticket:${ticketId}`, 'support_ticket:message', populatedMsg);
    emitSocketEvent('admin:support-tickets', 'support_ticket:updated', { ticketId, status: ticket.status });

    // Send notification
    try {
      const recipientId = isAdmin ? ticket.user : null;
      await notificationsService.createNotification(recipientId, {
        title: `Update on Ticket #${ticket.ticketNumber}`,
        message: messageText.length > 60 ? messageText.substring(0, 60) + '...' : messageText,
        type: 'support_ticket_message',
        referenceId: ticket._id,
        referenceType: 'SupportTicket',
      });
    } catch (_) {}

    return populatedMsg;
  },

  /**
   * Update ticket status (open, pending, resolved, closed)
   */
  updateStatus: async (ticketId, status, userId, isAdmin = false) => {
    const filter = { _id: ticketId };
    if (!isAdmin) {
      // Customer can mark resolved or close
      filter.user = userId;
    }

    const ticket = await SupportTicket.findOne(filter);
    if (!ticket) {
      throw new AppError('Support ticket not found', 404);
    }

    ticket.status = status.toLowerCase();
    if (ticket.status === 'resolved') {
      ticket.resolvedAt = new Date();
    } else if (ticket.status === 'closed') {
      ticket.closedAt = new Date();
    }
    await ticket.save();

    const populatedTicket = await SupportTicket.findById(ticket._id).populate('user', 'name email phone profileImage');

    emitSocketEvent(`support-ticket:${ticketId}`, 'support_ticket:status_changed', {
      ticketId,
      status: ticket.status,
    });
    emitSocketEvent('admin:support-tickets', 'support_ticket:updated', populatedTicket);

    return populatedTicket;
  },

  /**
   * Admin: Get all tickets with filtering & search
   */
  adminGetAll: async (query = {}) => {
    const filter = {};
    if (query.status && query.status !== 'all') {
      filter.status = query.status.toLowerCase();
    }
    if (query.category && query.category !== 'all') {
      filter.category = query.category;
    }

    const page = parseInt(query.page, 10) || 1;
    const limit = parseInt(query.limit, 10) || 50;
    const skip = (page - 1) * limit;

    const [tickets, total] = await Promise.all([
      SupportTicket.find(filter)
        .populate('user', 'name email phone profileImage')
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit),
      SupportTicket.countDocuments(filter),
    ]);

    return {
      tickets,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  },
};

export default supportTicketsService;
