import AppError from '../../errors/AppError.js';
import {
  RareProductRequest,
  RareQuotation,
  RareChatMessage,
  RareRequestActivity,
} from './rare-requests.model.js';
import Products from '../products/products.model.js';
import Categories from '../categories/categories.model.js';
import Order from '../orders/orders.model.js';
import Addresses from '../addresses/addresses.model.js';
import { InventoryItem, StockMovement } from '../inventory/inventory.model.js';
import { runInTransaction } from '../../utils/transaction.js';
import { uploadFile } from '../../utils/storage.js';
import notificationsService from '../notifications/notifications.service.js';

// Safe Socket.IO event emitter
const emitSocketEvent = async (room, event, payload) => {
  try {
    const { getIO } = await import('../../config/socket.js');
    getIO().to(room).emit(event, payload);
  } catch (err) {
    console.log(`[Socket.IO Fallback] Event ${event} to ${room} skipped: socket.io not initialized`);
  }
};

export const rareRequestsService = {
  /**
   * Submit a new Rare Product Request (Customer)
   */
  createRequest: async (userId, data) => {
    let customerName = data.customerName || '';
    let phone = data.phone || '';
    try {
      const Users = (await import('../users/users.model.js')).default;
      const userDoc = await Users.findById(userId);
      if (userDoc) {
        if (!customerName) customerName = userDoc.name || '';
        if (!phone) phone = userDoc.phone || '';
      }
    } catch (_) {}

    const requestDoc = await RareProductRequest.create({
      user: userId,
      customerName,
      phone,
      ...data,
      status: 'submitted',
    });

    // Log activity
    await RareRequestActivity.create({
      request: requestDoc._id,
      user: userId,
      type: 'status_change',
      description: 'Request submitted successfully',
    });

    // Create system chat message
    await RareChatMessage.create({
      request: requestDoc._id,
      sender: userId,
      senderType: 'system',
      messageType: 'system',
      message: `Rare product request submitted for "${requestDoc.title}"`,
    });

    // Emit Socket events
    emitSocketEvent('admin:rare-requests', 'rare_request:new', {
      requestId: requestDoc._id,
      title: requestDoc.title,
      userName: requestDoc.user.name,
    });

    // Trigger new sourcing request notification
    try {
      await notificationsService.createNotification(null, {
        title: 'New Sourcing Request',
        message: `A new sourcing request for "${requestDoc.title}" has been submitted.`,
        type: 'new_rare_request',
        referenceId: requestDoc._id,
        referenceType: 'RareProductRequest',
      });
    } catch (err) {
      console.error('Failed to trigger sourcing request notification:', err);
    }

    return requestDoc;
  },

  /**
   * Get customer's own request listings
   */
  getMyRequests: async (userId) => {
    const requests = await RareProductRequest.find({ user: userId }).sort({ createdAt: -1 });
    return Promise.all(
      requests.map(async (req) => {
        const quotation = await RareQuotation.findOne({ request: req._id, status: { $ne: 'cancelled' } }).sort({ createdAt: -1 });
        const reqObj = req.toObject();
        reqObj.activeQuotation = quotation;
        reqObj.ticketId = reqObj.ticketId || ('REQ-' + req._id.toString().slice(-6).toUpperCase());
        reqObj.productName = reqObj.title || reqObj.partName || '';
        reqObj.vehicle = {
          brand: req.vehicleBrand || '',
          name: req.vehicleModel || '',
          year: req.vehicleYear ? req.vehicleYear.toString() : '',
          type: req.vehicleType ? req.vehicleType.toLowerCase() : 'universal',
        };
        return reqObj;
      })
    );
  },

  /**
   * Get specific request details
   */
  getRequestById: async (userId, id, isAdmin = false) => {
    const query = isAdmin ? { _id: id } : { _id: id, user: userId };
    const requestDoc = await RareProductRequest.findOne(query).populate('user').populate('convertedOrder');
    if (!requestDoc) {
      throw new AppError('Request not found.', 404);
    }
    const quotation = await RareQuotation.findOne({ request: id, status: { $ne: 'cancelled' } }).sort({ createdAt: -1 });
    const reqObj = requestDoc.toObject();
    reqObj.activeQuotation = quotation;
    return reqObj;
  },

  /**
   * Update request details (Customer)
   */
  updateRequest: async (userId, id, data) => {
    const requestDoc = await RareProductRequest.findOne({ _id: id, user: userId });
    if (!requestDoc) {
      throw new AppError('Request not found.', 404);
    }

    const uneditableStatuses = ['approved', 'converted_to_order', 'cancelled'];
    if (uneditableStatuses.includes(requestDoc.status)) {
      throw new AppError(`Cannot modify details in ${requestDoc.status} state.`, 400);
    }

    Object.keys(data).forEach((key) => {
      requestDoc[key] = data[key];
    });

    await requestDoc.save();

    emitSocketEvent(`rare-request:${id}`, 'rare_request:updated', { requestId: id });
    return requestDoc;
  },

  /**
   * Upload and attach images to a request
   */
  addRequestImages: async (userId, id, files, isAdmin = false) => {
    // Find request
    const query = isAdmin ? { _id: id } : { _id: id, user: userId };
    const requestDoc = await RareProductRequest.findOne(query);
    if (!requestDoc) {
      throw new AppError('Request not found.', 404);
    }

    const uploadedImages = [];
    for (const file of files) {
      const result = await uploadFile(file);
      uploadedImages.push({
        url: result.url,
        publicId: result.publicId,
        uploadedAt: new Date(),
      });
    }

    // Push into request images array
    requestDoc.images.push(...uploadedImages);
    await requestDoc.save();

    // Log system chat and activity
    const actionBy = isAdmin ? 'Admin' : 'Customer';
    await RareChatMessage.create({
      request: id,
      sender: userId,
      senderType: isAdmin ? 'admin' : 'customer',
      messageType: 'image',
      imageUrl: uploadedImages[0]?.url || '',
      message: `${actionBy} uploaded ${uploadedImages.length} image(s)`,
    });

    emitSocketEvent(`rare-request:${id}`, 'rare_request:updated', { requestId: id });
    return requestDoc;
  },

  /**
   * Get chat messages history
   */
  getChatMessages: async (userId, id, isAdmin = false) => {
    const query = isAdmin ? { _id: id } : { _id: id, user: userId };
    const requestDoc = await RareProductRequest.findOne(query);
    if (!requestDoc) {
      throw new AppError('Request not found.', 404);
    }

    return RareChatMessage.find({ request: id })
      .populate('sender', 'name profileImage')
      .populate('quotation')
      .sort({ createdAt: 1 });
  },

  /**
   * Post chat message
   */
  sendChatMessage: async (userId, id, text, isAdmin = false) => {
    const query = isAdmin ? { _id: id } : { _id: id, user: userId };
    const requestDoc = await RareProductRequest.findOne(query);
    if (!requestDoc) {
      throw new AppError('Request not found.', 404);
    }

    const senderType = isAdmin ? 'admin' : 'customer';

    const chatMsg = await RareChatMessage.create({
      request: id,
      sender: userId,
      senderType,
      messageType: 'text',
      message: text,
      readBy: [userId],
      receivedBy: [userId],
    });

    const populatedMsg = await RareChatMessage.findById(chatMsg._id).populate('sender', 'name profileImage').populate('quotation');

    // Emit event
    emitSocketEvent(`rare-request:${id}`, 'rare_chat:message', populatedMsg);
    emitSocketEvent('admin:rare-requests', 'rare_chat:message', populatedMsg);

    // Trigger chat message notification
    try {
      const recipientId = isAdmin ? requestDoc.user : null;
      await notificationsService.createNotification(recipientId, {
        title: 'New Chat Message',
        message: text.length > 50 ? text.substring(0, 50) + '...' : text,
        type: 'new_chat_message',
        referenceId: requestDoc._id,
        referenceType: 'RareProductRequest',
      });
    } catch (err) {
      console.error('Failed to trigger chat message notification:', err);
    }

    return populatedMsg;
  },

  /**
   * Get request quotations
   */
  getQuotations: async (userId, id, isAdmin = false) => {
    const query = isAdmin ? { _id: id } : { _id: id, user: userId };
    const requestDoc = await RareProductRequest.findOne(query);
    if (!requestDoc) {
      throw new AppError('Request not found.', 404);
    }

    return RareQuotation.find({ request: id }).sort({ createdAt: -1 });
  },

  /**
   * Approve Quotation (Customer)
   */
  approveQuotation: async (userId, id, quotationId) => {
    const requestDoc = await RareProductRequest.findOne({ _id: id, user: userId });
    if (!requestDoc) {
      throw new AppError('Request not found.', 404);
    }

    const quotation = await RareQuotation.findOne({ _id: quotationId, request: id });
    if (!quotation) {
      throw new AppError('Quotation not found.', 404);
    }

    if (quotation.status !== 'sent') {
      throw new AppError('Only active sent quotations can be approved.', 400);
    }

    if (new Date() > quotation.expiresAt) {
      quotation.status = 'expired';
      await quotation.save();
      throw new AppError('Quotation has expired.', 400);
    }

    quotation.status = 'approved';
    requestDoc.status = 'approved';

    await quotation.save();
    await requestDoc.save();

    // Log activity
    await RareRequestActivity.create({
      request: id,
      user: userId,
      type: 'quotation_approved',
      description: `Quotation approved by customer: ${quotation.quotationNumber}`,
    });

    const chatMsg = await RareChatMessage.create({
      request: id,
      sender: userId,
      senderType: 'customer',
      messageType: 'system',
      message: `Quotation ${quotation.quotationNumber} approved by customer. Ready for conversion.`,
    });

    const populatedMsg = await RareChatMessage.findById(chatMsg._id)
      .populate('sender', 'name profileImage')
      .populate('quotation');

    if (populatedMsg) {
      emitSocketEvent(`rare-request:${id}`, 'rare_chat:message', populatedMsg);
    }

    const reqObj = requestDoc.toObject();
    reqObj.activeQuotation = quotation;

    emitSocketEvent(`rare-request:${id}`, 'rare_request:updated', reqObj);
    emitSocketEvent('admin:rare-requests', 'rare_request:updated', reqObj);
    emitSocketEvent(`rare-request:${id}`, 'quotation:approved', {
      requestId: id,
      quotationId,
    });

    return { request: reqObj, quotation };
  },

  /**
   * Reject/Cancel Quotation (Customer)
   */
  cancelQuotation: async (userId, id, quotationId, reason = '') => {
    const requestDoc = await RareProductRequest.findOne({ _id: id, user: userId });
    if (!requestDoc) {
      throw new AppError('Request not found.', 404);
    }

    const quotation = await RareQuotation.findOne({ _id: quotationId, request: id });
    if (!quotation) {
      throw new AppError('Quotation not found.', 404);
    }

    if (quotation.status !== 'sent') {
      throw new AppError('Quotation cannot be cancelled at this stage.', 400);
    }

    quotation.status = 'cancelled';
    requestDoc.status = 'cancelled';
    requestDoc.cancellation = {
      reason: reason || 'Quotation rejected by customer',
      cancelledBy: userId,
      cancelledAt: new Date(),
    };

    await quotation.save();
    await requestDoc.save();

    await RareRequestActivity.create({
      request: id,
      user: userId,
      type: 'quotation_cancelled',
      description: `Quotation rejected: ${quotation.quotationNumber}`,
    });

    const chatMsg = await RareChatMessage.create({
      request: id,
      sender: userId,
      senderType: 'customer',
      messageType: 'system',
      message: `Quotation ${quotation.quotationNumber} rejected by customer`,
    });

    const populatedMsg = await RareChatMessage.findById(chatMsg._id)
      .populate('sender', 'name profileImage')
      .populate('quotation');

    if (populatedMsg) {
      emitSocketEvent(`rare-request:${id}`, 'rare_chat:message', populatedMsg);
    }

    const reqObj = requestDoc.toObject();
    reqObj.activeQuotation = quotation;

    emitSocketEvent(`rare-request:${id}`, 'rare_request:updated', reqObj);
    emitSocketEvent('admin:rare-requests', 'rare_request:updated', reqObj);
    emitSocketEvent(`rare-request:${id}`, 'quotation:cancelled', {
      requestId: id,
      quotationId,
    });

    return quotation;
  },

  /**
   * Reopen a cancelled or resolved request (Customer)
   */
  reopenRequest: async (userId, id) => {
    const requestDoc = await RareProductRequest.findOne({ _id: id, user: userId });
    if (!requestDoc) {
      throw new AppError('Request not found.', 404);
    }

    const openableStatuses = ['cancelled', 'approved'];
    if (!openableStatuses.includes(requestDoc.status)) {
      throw new AppError('Only cancelled or approved requests can be reopened.', 400);
    }

    requestDoc.status = 'submitted';
    await requestDoc.save();

    await RareRequestActivity.create({
      request: id,
      user: userId,
      type: 'reopened',
      description: 'Request reopened by customer',
    });

    await RareChatMessage.create({
      request: id,
      sender: userId,
      senderType: 'system',
      messageType: 'system',
      message: 'Request reopened. Search status reset.',
    });

    emitSocketEvent(`rare-request:${id}`, 'rare_request:updated', { requestId: id });
    return requestDoc;
  },

  /**
   * List all Rare requests (Admin)
   */
  adminGetAll: async () => {
    const requests = await RareProductRequest.find().populate('user', 'name email phone profileImage').sort({ createdAt: -1 });
    return Promise.all(
      requests.map(async (req) => {
        const quotation = await RareQuotation.findOne({ request: req._id, status: { $ne: 'cancelled' } }).sort({ createdAt: -1 });
        const reqObj = req.toObject();
        reqObj.activeQuotation = quotation;
        reqObj.ticketId = reqObj.ticketId || ('REQ-' + req._id.toString().slice(-6).toUpperCase());
        reqObj.productName = reqObj.title || reqObj.partName || '';
        reqObj.vehicle = {
          brand: req.vehicleBrand || '',
          name: req.vehicleModel || '',
          year: req.vehicleYear ? req.vehicleYear.toString() : '',
          type: req.vehicleType ? req.vehicleType.toLowerCase() : 'universal',
        };
        return reqObj;
      })
    );
  },

  /**
   * Admin retrieve request detail
   */
  adminGetById: async (id) => {
    const requestDoc = await RareProductRequest.findById(id)
      .populate('user', 'name email phone profileImage')
      .populate('convertedOrder');
    if (!requestDoc) {
      throw new AppError('Request not found.', 404);
    }
    const quotation = await RareQuotation.findOne({ request: id, status: { $ne: 'cancelled' } }).sort({ createdAt: -1 });
    const reqObj = requestDoc.toObject();
    reqObj.activeQuotation = quotation;
    reqObj.ticketId = reqObj.ticketId || ('REQ-' + requestDoc._id.toString().slice(-6).toUpperCase());
    reqObj.productName = reqObj.title || reqObj.partName || '';
    reqObj.vehicle = {
      brand: requestDoc.vehicleBrand || '',
      name: requestDoc.vehicleModel || '',
      year: requestDoc.vehicleYear ? requestDoc.vehicleYear.toString() : '',
      type: requestDoc.vehicleType ? requestDoc.vehicleType.toLowerCase() : 'universal',
    };
    return reqObj;
  },

  /**
   * Admin update request status
   */
  adminUpdateStatus: async (id, status, notes = '', adminId) => {
    const requestDoc = await RareProductRequest.findById(id);
    if (!requestDoc) {
      throw new AppError('Request not found.', 404);
    }

    if (requestDoc.status === status) {
      return requestDoc;
    }

    requestDoc.status = status;
    if (status === 'cancelled') {
      requestDoc.cancellation = {
        reason: notes || 'Cancelled by admin',
        cancelledBy: adminId,
        cancelledAt: new Date(),
      };
    }

    await requestDoc.save();

    // Log Activity
    await RareRequestActivity.create({
      request: id,
      user: adminId,
      type: 'status_change',
      description: `Request status updated to ${status} by admin`,
    });

    await RareChatMessage.create({
      request: id,
      sender: adminId,
      senderType: 'system',
      messageType: 'status_update',
      message: `Request status updated to ${status}`,
    });

    emitSocketEvent(`rare-request:${id}`, 'rare_request:status_changed', {
      requestId: id,
      status,
    });

    return requestDoc;
  },

  /**
   * Admin create quotation draft
   */
  adminCreateQuotation: async (id, data, adminId) => {
    const requestDoc = await RareProductRequest.findById(id);
    if (!requestDoc) {
      throw new AppError('Request not found.', 404);
    }

    // Totals calculations entirely on server in paise
    let subTotal = 0;
    const items = data.items.map((item) => {
      const totalPrice = item.quantity * item.unitPrice;
      subTotal += totalPrice;
      return {
        ...item,
        totalPrice,
      };
    });

    const taxAmount = Math.round(subTotal * 0.18); // default 18% GST
    const deliveryFee = data.deliveryFee || 0;
    const grandTotal = subTotal + taxAmount + deliveryFee;

    const quotationNumber = `QTN-${Date.now().toString().slice(-6)}${Math.floor(10 + Math.random() * 90)}`;

    const quotation = await RareQuotation.create({
      request: id,
      quotationNumber,
      items,
      subTotal,
      taxAmount,
      deliveryFee,
      grandTotal,
      status: 'draft',
      expiresAt: new Date(data.expiresAt),
      createdBy: adminId,
    });

    return quotation;
  },

  /**
   * Admin revise/update a draft quotation (Preserves quotation history and revision count)
   */
  adminUpdateQuotation: async (id, quotationId, data, adminId) => {
    const original = await RareQuotation.findOne({ _id: quotationId, request: id });
    if (!original) {
      throw new AppError('Quotation not found.', 404);
    }

    const blockedStatuses = ['approved', 'converted_to_order', 'expired'];
    if (blockedStatuses.includes(original.status)) {
      throw new AppError(`Cannot revise quotation in ${original.status} status.`, 400);
    }

    // Cancel old quotation to replace it
    original.status = 'cancelled';
    await original.save();

    // Recalculate totals in paise
    let subTotal = 0;
    const items = (data.items || original.items).map((item) => {
      const qty = item.quantity !== undefined ? item.quantity : item.toObject().quantity;
      const price = item.unitPrice !== undefined ? item.unitPrice : item.toObject().unitPrice;
      const totalPrice = qty * price;
      subTotal += totalPrice;
      return {
        name: item.name || item.toObject().name,
        partNumber: item.partNumber || item.toObject().partNumber || '',
        quantity: qty,
        unitPrice: price,
        taxPercentage: item.taxPercentage !== undefined ? item.taxPercentage : item.toObject().taxPercentage || 18,
        totalPrice,
      };
    });

    const taxAmount = Math.round(subTotal * 0.18);
    const deliveryFee = data.deliveryFee !== undefined ? data.deliveryFee : original.deliveryFee;
    const grandTotal = subTotal + taxAmount + deliveryFee;

    const newQuotation = await RareQuotation.create({
      request: id,
      quotationNumber: original.quotationNumber,
      items,
      subTotal,
      taxAmount,
      deliveryFee,
      grandTotal,
      status: 'draft',
      expiresAt: new Date(data.expiresAt || original.expiresAt),
      revisedFrom: original._id,
      revisionNumber: original.revisionNumber + 1,
      createdBy: adminId,
    });

    return newQuotation;
  },

  /**
   * Admin send quotation to user
   */
  adminSendQuotation: async (id, quotationId, adminId) => {
    const requestDoc = await RareProductRequest.findById(id);
    if (!requestDoc) {
      throw new AppError('Request not found.', 404);
    }

    const quotation = await RareQuotation.findOne({ _id: quotationId, request: id });
    if (!quotation) {
      throw new AppError('Quotation not found.', 404);
    }

    if (quotation.status !== 'draft') {
      throw new AppError('Only draft quotations can be sent.', 400);
    }

    quotation.status = 'sent';
    requestDoc.status = 'quotation_sent';

    await quotation.save();
    await requestDoc.save();

    // Log Activity and Chat
    await RareRequestActivity.create({
      request: id,
      user: adminId,
      type: 'quotation_sent',
      description: `Quotation sent to customer: ${quotation.quotationNumber}`,
    });

    await RareChatMessage.create({
      request: id,
      sender: adminId,
      senderType: 'admin',
      messageType: 'quotation',
      quotation: quotationId,
      message: `Admin sent quotation ${quotation.quotationNumber} for ₹${(quotation.grandTotal / 100).toFixed(2)}`,
    });

    const populatedMsg = await RareChatMessage.findOne({ request: id, messageType: 'quotation', quotation: quotationId })
      .populate('sender', 'name profileImage')
      .populate('quotation');
    if (populatedMsg) {
      emitSocketEvent(`rare-request:${id}`, 'rare_chat:message', populatedMsg);
    }
    emitSocketEvent(`rare-request:${id}`, 'quotation:sent', {
      requestId: id,
      quotationId,
    });
    emitSocketEvent(`rare-request:${id}`, 'rare_request:updated', {
      requestId: id,
      status: 'quotation_sent',
    });

    // Trigger quotation notification
    try {
      await notificationsService.createNotification(requestDoc.user, {
        title: 'New Quotation Received',
        message: `Admin has sent a quotation ${quotation.quotationNumber} for your rare request.`,
        type: 'quotation',
        referenceId: requestDoc._id,
        referenceType: 'RareProductRequest',
      });
    } catch (err) {
      console.error('Failed to trigger quotation notification:', err);
    }

    return quotation;
  },

  /**
   * Admin convert approved request to Order (Transaction execution)
   */
  adminConvertToOrder: async (id, addressId, adminId) => {
    return runInTransaction(async (session) => {
      const requestDoc = await RareProductRequest.findById(id).session(session);
      if (!requestDoc) {
        throw new AppError('Request not found.', 404);
      }

      if (requestDoc.status !== 'approved' && requestDoc.status !== 'quotation_sent') {
        throw new AppError('Only approved or quoted requests can be converted to orders.', 400);
      }

      let quotation = await RareQuotation.findOne({ request: id, status: 'approved' }).session(session);
      if (!quotation) {
        quotation = await RareQuotation.findOne({ request: id, status: 'sent' }).sort({ createdAt: -1 }).session(session);
      }
      if (!quotation) {
        throw new AppError('No valid quotation found for this request.', 404);
      }

      quotation.status = 'approved';
      await quotation.save({ session });

      let address = null;
      if (addressId) {
        try {
          address = await Addresses.findById(addressId).session(session);
        } catch (_) {}
      }
      if (!address) {
        address = await Addresses.findOne({ user: requestDoc.user }).session(session);
      }
      if (!address) {
        const userDoc = await Users.findById(requestDoc.user).session(session);
        address = {
          recipientName: userDoc?.name || 'Customer',
          phone: userDoc?.phone || '9876543210',
          addressLine1: 'Customer Primary Delivery Address',
          addressLine2: '',
          city: 'Chennai',
          state: 'Tamil Nadu',
          postalCode: '600001',
          country: 'India',
        };
      }

      // Check default Category for dynamic registering
      let defaultCategory = await Categories.findOne({ name: 'Engine Spares' }).session(session);
      if (!defaultCategory) {
        const catList = await Categories.create([{ name: 'Engine Spares', slug: 'engine-spares', active: true }], { session });
        defaultCategory = catList[0];
      }

      const orderItems = [];

      for (const item of quotation.items) {
        let product = await Products.findOne({
          $or: [
            { name: item.name },
            ...(item.partNumber ? [{ partNumber: item.partNumber }] : []),
          ],
        }).session(session);

        if (!product) {
          const sku = item.partNumber || `RARE-${Math.floor(100000 + Math.random() * 900000)}`;
          const productList = await Products.create(
            [
              {
                sku,
                name: item.name,
                slug: item.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Date.now().toString(36),
                brand: requestDoc.vehicleBrand,
                category: defaultCategory._id,
                sellingPrice: item.unitPrice,
                mrp: item.unitPrice * 1.2,
                purchasePrice: item.unitPrice * 0.7,
                currentStock: item.quantity,
                active: true,
              },
            ],
            { session }
          );
          product = productList[0];
        }

        // Concurrency Stock updates
        await Products.findOneAndUpdate(
          { _id: product._id },
          { $inc: { currentStock: -item.quantity } },
          { session }
        );

        orderItems.push({
          product: product._id,
          productSnapshot: {
            name: product.name,
            sku: product.sku,
            slug: product.slug,
            sellingPrice: product.sellingPrice,
            purchasePrice: product.purchasePrice,
            mrp: product.mrp,
            image: '',
          },
          quantity: item.quantity,
          unitPrice: product.sellingPrice,
          taxPercentage: item.taxPercentage || 18,
          totalPrice: item.totalPrice || (item.unitPrice * item.quantity),
        });
      }

      // Calculate totals in Rupees for Order
      const grandTotal = quotation.grandTotal;
      const subTotal = quotation.subTotal;
      const taxAmount = quotation.taxAmount;
      const deliveryFee = quotation.deliveryFee || 0;
      const orderNumber = `ORD-RARE-${Math.floor(100000 + Math.random() * 900000)}`;

      // Calculate estimated delivery
      const days = parseInt(quotation.deliveryTimeline) || 4;
      const estimatedDeliveryDate = new Date();
      estimatedDeliveryDate.setDate(estimatedDeliveryDate.getDate() + days);

      const orderList = await Order.create(
        [
          {
            orderNumber,
            user: requestDoc.user,
            items: orderItems,
            shippingAddress: {
              recipientName: address.recipientName,
              phone: address.phone,
              addressLine1: address.addressLine1,
              addressLine2: address.addressLine2 || '',
              city: address.city,
              state: address.state,
              postalCode: address.postalCode,
              country: address.country || 'India',
            },
            subTotal,
            taxAmount,
            deliveryFee,
            grandTotal,
            estimatedDeliveryDate,
            deliveryTimeline: quotation.deliveryTimeline || '3-5 Business Days',
            status: 'confirmed',
            paymentStatus: 'unpaid',
            statusHistory: [{ status: 'confirmed', notes: `Order placed from Rare Request quotation. Est. Delivery: ${estimatedDeliveryDate.toLocaleDateString()}` }],
          },
        ],
        { session }
      );
      const createdOrder = orderList[0];

      // Update Request details
      requestDoc.status = 'converted_to_order';
      requestDoc.convertedOrder = createdOrder._id;
      await requestDoc.save({ session });

      // Log activity and chat
      await RareRequestActivity.create(
        [
          {
            request: id,
            user: adminId,
            type: 'converted_to_order',
            description: `Request converted to order successfully: ${orderNumber}. Estimated delivery: ${estimatedDeliveryDate.toDateString()}`,
          },
        ],
        { session }
      );

      const chatMsg = await RareChatMessage.create(
        [
          {
            request: id,
            sender: adminId,
            senderType: 'system',
            messageType: 'system',
            message: `Request converted to Order ${orderNumber}. Estimated delivery: ${estimatedDeliveryDate.toDateString()} (${quotation.deliveryTimeline || '3-5 Days'})`,
          },
        ],
        { session }
      );

      const populatedMsg = await RareChatMessage.findById(chatMsg[0]._id)
        .populate('sender', 'name profileImage');

      if (populatedMsg) {
        emitSocketEvent(`rare-request:${id}`, 'rare_chat:message', populatedMsg);
      }

      const reqObj = requestDoc.toObject();
      reqObj.activeQuotation = quotation;
      reqObj.convertedOrder = createdOrder;

      emitSocketEvent(`rare-request:${id}`, 'rare_request:updated', reqObj);
      emitSocketEvent('admin:rare-requests', 'rare_request:updated', reqObj);
      emitSocketEvent(`rare-request:${id}`, 'request:converted_to_order', {
        requestId: id,
        orderId: createdOrder._id,
        orderNumber,
        estimatedDeliveryDate,
      });

      return createdOrder;
    });
  },
};

export default rareRequestsService;
