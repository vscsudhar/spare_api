import mongoose from 'mongoose';

// 1. Support Ticket Attachment Schema
const supportAttachmentSchema = new mongoose.Schema({
  url: {
    type: String,
    required: true,
  },
  uploadedAt: {
    type: Date,
    default: Date.now,
  },
});

// 2. Support Ticket Schema
const supportTicketSchema = new mongoose.Schema(
  {
    ticketNumber: {
      type: String,
      unique: true,
      required: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Users',
      required: true,
      index: true,
    },
    subject: {
      type: String,
      required: [true, 'Subject is required'],
      trim: true,
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      enum: [
        'General',
        'Order Issue',
        'Payment Query',
        'Product Information',
        'Return/Refund',
        'Delivery',
        'Technical Support',
      ],
      default: 'General',
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
    },
    status: {
      type: String,
      enum: ['open', 'pending', 'resolved', 'closed'],
      default: 'open',
      index: true,
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium',
    },
    photos: [supportAttachmentSchema],
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Users',
      default: null,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
    closedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// 3. Support Ticket Message Schema
const supportTicketMessageSchema = new mongoose.Schema(
  {
    ticket: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SupportTicket',
      required: true,
      index: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Users',
      required: true,
    },
    senderRole: {
      type: String,
      enum: ['customer', 'admin', 'staff'],
      default: 'customer',
    },
    message: {
      type: String,
      required: [true, 'Message content is required'],
      trim: true,
    },
    attachments: [supportAttachmentSchema],
    isRead: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

export const SupportTicket =
  mongoose.models.SupportTicket ||
  mongoose.model('SupportTicket', supportTicketSchema);

export const SupportTicketMessage =
  mongoose.models.SupportTicketMessage ||
  mongoose.model('SupportTicketMessage', supportTicketMessageSchema);

export default SupportTicket;
