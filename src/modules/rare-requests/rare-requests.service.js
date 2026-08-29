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
    const requestDoc = await RareProductRequest.create({
      user: userId,
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
    return RareProductRequest.find({ user: userId }).sort({ createdAt: -1 });
  },

  /**
   * Get specific request details
   */
  getRequestById: async (userId, id) => {
    const requestDoc = await RareProductRequest.findOne({ _id: id, user: userId });
    if (!requestDoc) {
      throw new AppError('Request not found.', 404);
    }
    return requestDoc;
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

    const populatedMsg = await RareChatMessage.findById(chatMsg._id).populate(
      'sender',
      'name profileImage'
    );

    // Emit event
    emitSocketEvent(`rare-request:${id}`, 'rare_chat:message', populatedMsg);

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

    // Log logs
    await RareRequestActivity.create({
      request: id,
      user: userId,
      type: 'quotation_approved',
      description: `Quotation approved by customer: ${quotation.quotationNumber}`,
    });

    await RareChatMessage.create({
      request: id,
      sender: userId,
      senderType: 'customer',
      messageType: 'system',
      message: `Quotation ${quotation.quotationNumber} approved by customer. Ready for conversion.`,
    });

    emitSocketEvent(`rare-request:${id}`, 'quotation:approved', {
      requestId: id,
      quotationId,
    });

    return { request: requestDoc, quotation };
  },

  /**
   * Reject/Cancel Quotation (Customer)
   */
  cancelQuotation: async (userId, id, quotationId) => {
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
    await quotation.save();

    await RareRequestActivity.create({
      request: id,
      user: userId,
      type: 'quotation_cancelled',
      description: `Quotation rejected: ${quotation.quotationNumber}`,
    });

    await RareChatMessage.create({
      request: id,
      sender: userId,
      senderType: 'customer',
      messageType: 'system',
      message: `Quotation ${quotation.quotationNumber} rejected by customer`,
    });

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
    return RareProductRequest.find().populate('user', 'name email').sort({ createdAt: -1 });
  },

  /**
   * Admin retrieve request detail
   */
  adminGetById: async (id) => {
    const requestDoc = await RareProductRequest.findById(id).populate('user').populate('convertedOrder');
    if (!requestDoc) {
      throw new AppError('Request not found.', 404);
    }
    return requestDoc;
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

    emitSocketEvent(`rare-request:${id}`, 'quotation:sent', {
      requestId: id,
      quotationId,
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

      if (requestDoc.status !== 'approved') {
        throw new AppError('Only approved requests can be converted to orders.', 400);
      }

      const quotation = await RareQuotation.findOne({ request: id, status: 'approved' }).session(session);
      if (!quotation) {
        throw new AppError('No approved quotation found for this request.', 404);
      }

      const address = await Addresses.findById(addressId).session(session);
      if (!address || address.user.toString() !== requestDoc.user.toString()) {
        throw new AppError('Invalid shipping address.', 400);
      }

      // Check default Category for dynamic registering
      let defaultCategory = await Categories.findOne({ name: 'Engine Spares' }).session(session);
      if (!defaultCategory) {
        defaultCategory = await Categories.create([{ name: 'Engine Spares', slug: 'engine-spares', active: true }], { session });
        defaultCategory = defaultCategory[0];
      }

      const orderItems = [];

      for (const item of quotation.items) {
        // Dynamically register rare product in catalog if not present
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
                slug: item.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
                brand: requestDoc.vehicleBrand,
                category: defaultCategory._id,
                sellingPrice: item.unitPrice / 100, // paise to rupees
                mrp: (item.unitPrice / 100) * 1.2,
                purchasePrice: (item.unitPrice / 100) * 0.7,
                currentStock: item.quantity,
                active: true,
              },
            ],
            { session }
          );
          product = productList[0];
        }

        // Concurrency Stock updates
        const productUpdate = await Products.findOneAndUpdate(
          { _id: product._id, currentStock: { $gte: item.quantity }, isDeleted: { $ne: true } },
          { $inc: { currentStock: -item.quantity } },
          { session, new: true }
        );

        if (!productUpdate) {
          throw new AppError(`Dynamic product stock allocation failed for ${item.name}`, 400);
        }

        // Sync InventoryItem stock
        await InventoryItem.findOneAndUpdate(
          { product: product._id, currentStock: { $gte: item.quantity } },
          { $inc: { currentStock: -item.quantity } },
          { session }
        );

        // Record stock movement
        await StockMovement.create(
          [
            {
              product: product._id,
              type: 'sale',
              quantity: -item.quantity,
              referenceType: 'Order',
              notes: `Rare Request convert checkout: ${requestDoc.title}`,
              user: requestDoc.user,
            },
          ],
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
          taxPercentage: item.taxPercentage,
          totalPrice: item.totalPrice / 100,
        });
      }

      // Calculate totals in Rupees for Order
      const grandTotal = quotation.grandTotal / 100;
      const subTotal = quotation.subTotal / 100;
      const taxAmount = quotation.taxAmount / 100;
      const deliveryFee = quotation.deliveryFee / 100;
      const orderNumber = `ORD-RARE-${Math.floor(100000 + Math.random() * 900000)}`;

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
              addressLine2: address.addressLine2,
              city: address.city,
              state: address.state,
              postalCode: address.postalCode,
              country: address.country,
            },
            subTotal,
            taxAmount,
            deliveryFee,
            grandTotal,
            status: 'confirmed',
            paymentStatus: 'unpaid',
            statusHistory: [{ status: 'confirmed', notes: 'Order placed from Rare Product Request quotation' }],
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
            description: `Request converted to order successfully: ${orderNumber}`,
          },
        ],
        { session }
      );

      await RareChatMessage.create(
        [
          {
            request: id,
            sender: adminId,
            senderType: 'system',
            messageType: 'system',
            message: `Request converted to Order: ${orderNumber}`,
          },
        ],
        { session }
      );

      emitSocketEvent(`rare-request:${id}`, 'request:converted_to_order', {
        requestId: id,
        orderId: createdOrder._id,
        orderNumber,
      });

      return createdOrder;
    });
  },
};

export default rareRequestsService;
