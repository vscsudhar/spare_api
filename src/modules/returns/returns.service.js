import mongoose from 'mongoose';
import ReturnExchange from './returns.model.js';
import Order from '../orders/orders.model.js';
import Billing from '../billing/billing.model.js';
import Products from '../products/products.model.js';
import Users from '../users/users.model.js';
import { InventoryItem, StockMovement } from '../inventory/inventory.model.js';
import AppError from '../../errors/AppError.js';
import { runInTransaction } from '../../utils/transaction.js';

export const returnsService = {
  /**
   * Search bill or order by query string
   * Query can be: Order Number, Invoice Number, Order ObjectId, or Phone
   */
  searchBill: async (query) => {
    if (!query || !query.trim()) {
      throw new AppError('Search query is required', 400);
    }
    const q = query.trim();

    let order = null;
    let billing = null;

    // 1. Try search Billing by invoiceNumber or customerPhone
    billing = await Billing.findOne({
      $or: [
        { invoiceNumber: { $regex: new RegExp(`^${q}$`, 'i') } },
        { customerPhone: q },
      ],
    });

    if (billing && billing.order) {
      order = await Order.findById(billing.order)
        .populate('user')
        .populate('items.product');
    }

    // 2. If not found via Billing, search Order directly
    if (!order) {
      const orderQuery = [{ orderNumber: { $regex: new RegExp(`^${q}$`, 'i') } }];
      if (mongoose.Types.ObjectId.isValid(q)) {
        orderQuery.push({ _id: new mongoose.Types.ObjectId(q) });
      }
      orderQuery.push({ 'shippingAddress.phone': q });

      order = await Order.findOne({ $or: orderQuery })
        .populate('user')
        .populate('items.product');
    }

    // 3. If order found, try finding linked billing if not already found
    if (order && !billing) {
      billing = await Billing.findOne({
        $or: [{ order: order._id }, { invoiceNumber: order.orderNumber }],
      });
    }

    if (!order) {
      throw new AppError(`No order or bill found for: ${q}`, 404);
    }

    // 4. Retrieve existing ReturnExchange cases for this order to calculate cumulative quantities
    const existingCases = await ReturnExchange.find({
      order: order._id,
      status: { $nin: ['rejected', 'cancelled'] },
    }).sort({ createdAt: -1 });

    // Aggregate processed quantities per order item
    const itemProcessingMap = {};
    for (const kase of existingCases) {
      for (const itm of kase.items) {
        const strId = itm.orderItemId.toString();
        if (!itemProcessingMap[strId]) {
          itemProcessingMap[strId] = {
            returnedQty: 0,
            damagedQty: 0,
            exchangedQty: 0,
          };
        }
        if (itm.action === 'return') {
          itemProcessingMap[strId].returnedQty += itm.processedQty;
        } else if (itm.action === 'damage') {
          itemProcessingMap[strId].damagedQty += itm.processedQty;
        } else if (itm.action === 'exchange') {
          itemProcessingMap[strId].exchangedQty += itm.processedQty;
        }
      }
    }

    // Prepare items with remaining eligible quantity
    const itemsWithEligibility = order.items.map((item) => {
      const strId = item._id.toString();
      const stats = itemProcessingMap[strId] || {
        returnedQty: 0,
        damagedQty: 0,
        exchangedQty: 0,
      };

      const originalQty = item.quantity;
      const totalProcessed =
        stats.returnedQty + stats.damagedQty + stats.exchangedQty;
      const availableQty = Math.max(0, originalQty - totalProcessed);

      return {
        orderItemId: item._id,
        product: item.product?._id || item.product,
        name: item.productSnapshot?.name || item.product?.name || 'Spare Part',
        sku: item.productSnapshot?.sku || item.product?.sku || '',
        image: item.productSnapshot?.image || item.product?.images?.[0]?.url || '',
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
        taxPercentage: item.taxPercentage || 18,
        purchasedQty: originalQty,
        returnedQty: stats.returnedQty,
        damagedQty: stats.damagedQty,
        exchangedQty: stats.exchangedQty,
        availableQty,
      };
    });

    const customerName =
      order.shippingAddress?.recipientName ||
      order.user?.name ||
      billing?.customerName ||
      'Walk-in Customer';

    const customerPhone =
      order.shippingAddress?.phone ||
      order.user?.phone ||
      billing?.customerPhone ||
      '';

    return {
      orderId: order._id,
      orderNumber: order.orderNumber,
      billNumber: billing?.invoiceNumber || order.orderNumber,
      invoiceNumber: billing?.invoiceNumber || '',
      customer: {
        id: order.user?._id || null,
        name: customerName,
        phone: customerPhone,
        email: order.user?.email || '',
      },
      orderDate: order.createdAt,
      orderStatus: order.status,
      paymentStatus: order.paymentStatus,
      paymentMethod: order.paymentMethod || 'cash',
      grandTotal: order.grandTotal,
      subTotal: order.subTotal,
      taxAmount: order.taxAmount,
      items: itemsWithEligibility,
      existingCases: existingCases.map((c) => ({
        id: c._id,
        caseNumber: c.caseNumber,
        type: c.type,
        status: c.status,
        createdAt: c.createdAt,
        itemsCount: c.items.length,
      })),
    };
  },

  /**
   * Create a Return / Damage / Exchange case
   */
  createCase: async (userId, data) => {
    return runInTransaction(async (session) => {
      const { orderId, items = [], adminNotes = '' } = data;

      const order = await Order.findById(orderId).populate('items.product').session(session);
      if (!order) {
        throw new AppError('Order not found', 404);
      }

      // Check linked billing for invoice number
      const billing = await Billing.findOne({ order: order._id }).session(session);
      const invoiceNumber = billing?.invoiceNumber || '';
      const billNumber = invoiceNumber || order.orderNumber;

      // Existing cases for cumulative quantity validation
      const existingCases = await ReturnExchange.find({
        order: order._id,
        status: { $nin: ['rejected', 'cancelled'] },
      }).session(session);

      const itemProcessingMap = {};
      for (const kase of existingCases) {
        for (const itm of kase.items) {
          const strId = itm.orderItemId.toString();
          itemProcessingMap[strId] = (itemProcessingMap[strId] || 0) + itm.processedQty;
        }
      }

      // Action tracking for overall case type
      const actionTypes = new Set();
      const processedItems = [];
      let totalRefundAmount = 0;
      let totalPayableAmount = 0;

      for (const reqItem of items) {
        const orderItem = order.items.find(
          (oi) => oi._id.toString() === reqItem.orderItemId.toString()
        );
        if (!orderItem) {
          throw new AppError(`Order item not found: ${reqItem.orderItemId}`, 400);
        }

        const alreadyProcessed = itemProcessingMap[orderItem._id.toString()] || 0;
        const availableQty = orderItem.quantity - alreadyProcessed;

        if (reqItem.quantity > availableQty) {
          throw new AppError(
            `Requested quantity (${reqItem.quantity}) exceeds available quantity (${availableQty}) for ${orderItem.productSnapshot?.name || 'item'}`,
            400
          );
        }

        actionTypes.add(reqItem.action);

        let itemRefundAmount = 0;
        let diffType = 'none';
        let diffAmount = 0;
        let replacementProdDoc = null;

        // 1. Return action
        if (reqItem.action === 'return') {
          if (reqItem.refundRequired) {
            // Price calculation based on original item unitPrice
            itemRefundAmount = orderItem.unitPrice * reqItem.quantity;
            totalRefundAmount += itemRefundAmount;
          }
        }

        // 2. Damage action
        if (reqItem.action === 'damage') {
          if (reqItem.damageResolution === 'refund') {
            reqItem.refundRequired = true;
            itemRefundAmount = orderItem.unitPrice * reqItem.quantity;
            totalRefundAmount += itemRefundAmount;
          }
        }

        // 3. Exchange action
        if (reqItem.action === 'exchange') {
          if (!reqItem.replacementProductId) {
            throw new AppError('Replacement product is required for exchange', 400);
          }
          const replQty = reqItem.replacementQuantity || reqItem.quantity;

          replacementProdDoc = await Products.findById(reqItem.replacementProductId).session(session);
          if (!replacementProdDoc || replacementProdDoc.isDeleted) {
            throw new AppError('Replacement product not found or is unavailable', 404);
          }

          // Check replacement stock if stock-managed
          if (replacementProdDoc.stockManaged && replacementProdDoc.currentStock < replQty) {
            throw new AppError(
              `Insufficient stock for replacement product: ${replacementProdDoc.name} (available: ${replacementProdDoc.currentStock})`,
              400
            );
          }

          const originalExchangeValue = orderItem.unitPrice * reqItem.quantity;
          const replacementTotal = replacementProdDoc.sellingPrice * replQty;

          if (replacementTotal > originalExchangeValue) {
            diffType = 'payable';
            diffAmount = replacementTotal - originalExchangeValue;
            totalPayableAmount += diffAmount;
          } else if (replacementTotal < originalExchangeValue) {
            diffType = 'refundable';
            diffAmount = originalExchangeValue - replacementTotal;
            totalRefundAmount += diffAmount;
          } else {
            diffType = 'none';
            diffAmount = 0;
          }
        }

        processedItems.push({
          orderItemId: orderItem._id,
          product: orderItem.product?._id || orderItem.product,
          productNameSnapshot: orderItem.productSnapshot?.name || orderItem.product?.name || 'Part',
          skuSnapshot: orderItem.productSnapshot?.sku || orderItem.product?.sku || '',
          unitPrice: orderItem.unitPrice,
          originalQty: orderItem.quantity,
          processedQty: reqItem.quantity,
          action: reqItem.action,
          reasonCode: reqItem.reasonCode || '',
          reasonText: reqItem.reasonText,
          condition: reqItem.condition || 'unused',
          inventoryDisposition: reqItem.inventoryDisposition || (reqItem.action === 'damage' ? 'damaged' : 'sellable'),
          refundRequired: !!reqItem.refundRequired,
          refundAmount: itemRefundAmount,
          refundMethod: reqItem.refundMethod || 'none',
          refundStatus: reqItem.refundRequired ? 'pending' : 'na',
          replacementProduct: replacementProdDoc ? replacementProdDoc._id : null,
          replacementProductNameSnapshot: replacementProdDoc ? replacementProdDoc.name : '',
          replacementQty: reqItem.action === 'exchange' ? (reqItem.replacementQuantity || reqItem.quantity) : 0,
          differenceType: diffType,
          differenceAmount: diffAmount,
          damageType: reqItem.damageType || 'na',
          damageDiscoveredAt: reqItem.damageDiscoveredAt || 'na',
          damageResolution: reqItem.damageResolution || 'na',
          notes: reqItem.notes || '',
          images: reqItem.images || [],
        });
      }

      // Determine case type
      let caseType = 'return';
      if (actionTypes.size > 1) {
        caseType = 'mixed';
      } else if (actionTypes.has('damage')) {
        caseType = 'damage';
      } else if (actionTypes.has('exchange')) {
        caseType = 'exchange';
      }

      // Generate unique case number
      const year = new Date().getFullYear();
      const count = await ReturnExchange.countDocuments().session(session);
      const caseNumber = `RMA-${year}-${String(count + 1).padStart(5, '0')}`;

      // Get user name for audit log
      const adminUser = await Users.findById(userId).session(session);
      const adminName = adminUser?.name || 'Admin';

      const initialHistory = [
        {
          action: 'case_created',
          fromStatus: '',
          toStatus: 'pending',
          notes: `Case created for ${processedItems.length} item(s).`,
          changedBy: userId,
          changedByName: adminName,
          timestamp: new Date(),
        },
      ];

      const customerSnapshot = {
        name: order.shippingAddress?.recipientName || order.user?.name || billing?.customerName || 'Walk-in Customer',
        phone: order.shippingAddress?.phone || order.user?.phone || billing?.customerPhone || '',
      };

      const [newCase] = await ReturnExchange.create(
        [
          {
            caseNumber,
            order: order._id,
            billNumber,
            invoiceNumber,
            customer: order.user?._id || null,
            customerSnapshot,
            type: caseType,
            status: 'pending',
            items: processedItems,
            totalRefundAmount,
            totalPayableAmount,
            history: initialHistory,
            adminNotes,
            createdBy: userId,
            updatedBy: userId,
          },
        ],
        { session }
      );

      return newCase;
    });
  },

  /**
   * Get all cases with filtering and pagination
   */
  getAll: async (filters = {}) => {
    const { status, type, search, page = 1, limit = 50 } = filters;
    const query = {};

    if (status && status !== 'all') {
      query.status = status;
    }

    if (type && type !== 'all') {
      query.type = type;
    }

    if (search && search.trim()) {
      const term = search.trim();
      query.$or = [
        { caseNumber: { $regex: term, $options: 'i' } },
        { billNumber: { $regex: term, $options: 'i' } },
        { invoiceNumber: { $regex: term, $options: 'i' } },
        { 'customerSnapshot.name': { $regex: term, $options: 'i' } },
        { 'customerSnapshot.phone': { $regex: term, $options: 'i' } },
      ];
    }

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const [cases, total] = await Promise.all([
      ReturnExchange.find(query)
        .populate('order', 'orderNumber status createdAt')
        .populate('createdBy', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit, 10)),
      ReturnExchange.countDocuments(query),
    ]);

    return {
      cases,
      total,
      page: parseInt(page, 10),
      totalPages: Math.ceil(total / parseInt(limit, 10)),
    };
  },

  /**
   * Get case by ID with full details
   */
  getById: async (id) => {
    const kase = await ReturnExchange.findById(id)
      .populate('order')
      .populate('customer', 'name email phone')
      .populate('items.product', 'name sku images currentStock sellingPrice')
      .populate('items.replacementProduct', 'name sku images currentStock sellingPrice')
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email');

    if (!kase) {
      throw new AppError('Case not found', 404);
    }
    return kase;
  },

  /**
   * Update case status with transition validation, inventory updates, and immutable history
   */
  updateStatus: async (id, newStatus, notes = '', userId) => {
    return runInTransaction(async (session) => {
      const kase = await ReturnExchange.findById(id).session(session);
      if (!kase) {
        throw new AppError('Case not found', 404);
      }

      const oldStatus = kase.status;
      if (oldStatus === newStatus) {
        return kase;
      }

      // Validate status transition
      const allowedTransitions = {
        pending: ['approved', 'rejected', 'cancelled'],
        approved: ['received', 'processing', 'completed', 'cancelled'],
        received: ['processing', 'completed', 'cancelled'],
        processing: ['completed', 'cancelled'],
        completed: [],
        rejected: [],
        cancelled: [],
      };

      if (!allowedTransitions[oldStatus]?.includes(newStatus)) {
        throw new AppError(
          `Invalid status transition from '${oldStatus}' to '${newStatus}'`,
          400
        );
      }

      const adminUser = await Users.findById(userId).session(session);
      const adminName = adminUser?.name || 'Admin';

      // Inventory actions when transitioning to received or completed
      if (
        (newStatus === 'received' || newStatus === 'completed') &&
        oldStatus !== 'received' &&
        oldStatus !== 'completed'
      ) {
        for (const item of kase.items) {
          // 1. Handle old/returned product inventory based on disposition
          if (item.action === 'return' || item.action === 'exchange') {
            if (item.inventoryDisposition === 'sellable') {
              // Restock product sellable inventory
              await Products.findByIdAndUpdate(
                item.product,
                { $inc: { currentStock: item.processedQty } },
                { session }
              );
              await InventoryItem.findOneAndUpdate(
                { product: item.product },
                { $inc: { currentStock: item.processedQty } },
                { session }
              );
              await StockMovement.create(
                [
                  {
                    product: item.product,
                    type: 'return',
                    quantity: item.processedQty,
                    referenceType: 'ReturnExchange',
                    referenceId: kase._id,
                    user: userId,
                    notes: `RMA ${kase.caseNumber} sellable return restock`,
                  },
                ],
                { session }
              );
            } else if (item.inventoryDisposition === 'damaged') {
              // Log damaged stock movement without increasing sellable stock
              await StockMovement.create(
                [
                  {
                    product: item.product,
                    type: 'damage',
                    quantity: item.processedQty,
                    referenceType: 'ReturnExchange',
                    referenceId: kase._id,
                    user: userId,
                    notes: `RMA ${kase.caseNumber} damaged returned item`,
                  },
                ],
                { session }
              );
            }
          } else if (item.action === 'damage') {
            // Log damage movement
            await StockMovement.create(
              [
                {
                  product: item.product,
                  type: 'damage',
                  quantity: item.processedQty,
                  referenceType: 'ReturnExchange',
                  referenceId: kase._id,
                  user: userId,
                  notes: `RMA ${kase.caseNumber} damage report (${item.damageType})`,
                },
              ],
              { session }
            );
          }

          // 2. Handle replacement product inventory for exchanges
          if (item.action === 'exchange' && item.replacementProduct) {
            const replProduct = await Products.findById(item.replacementProduct).session(session);
            if (replProduct && replProduct.stockManaged) {
              if (replProduct.currentStock < item.replacementQty) {
                throw new AppError(
                  `Cannot complete exchange: Insufficient stock for replacement ${replProduct.name}`,
                  400
                );
              }
              await Products.findByIdAndUpdate(
                item.replacementProduct,
                { $inc: { currentStock: -item.replacementQty } },
                { session }
              );
              await InventoryItem.findOneAndUpdate(
                { product: item.replacementProduct },
                { $inc: { currentStock: -item.replacementQty } },
                { session }
              );
              await StockMovement.create(
                [
                  {
                    product: item.replacementProduct,
                    type: 'adjustment',
                    quantity: -item.replacementQty,
                    referenceType: 'ReturnExchange',
                    referenceId: kase._id,
                    user: userId,
                    notes: `RMA ${kase.caseNumber} replacement dispatch`,
                  },
                ],
                { session }
              );
            }
          }

          // 3. Mark refunds as processed if completing case
          if (newStatus === 'completed' && item.refundRequired) {
            item.refundStatus = 'processed';
          }
        }
      }

      // Append immutable history event
      kase.status = newStatus;
      kase.updatedBy = userId;
      kase.history.push({
        action: 'status_changed',
        fromStatus: oldStatus,
        toStatus: newStatus,
        notes: notes || `Status changed from ${oldStatus} to ${newStatus}`,
        changedBy: userId,
        changedByName: adminName,
        timestamp: new Date(),
      });

      await kase.save({ session });
      return kase;
    });
  },

  /**
   * Get list of all damaged products across cases with KPI metrics
   */
  getDamagedItems: async (filters = {}) => {
    const { damageType, damageDiscoveredAt, damageResolution, search, page = 1, limit = 50 } = filters;

    const pipeline = [
      { $match: { 'items.action': 'damage' } },
      { $unwind: '$items' },
      { $match: { 'items.action': 'damage' } },
    ];

    if (damageType && damageType !== 'all') {
      pipeline.push({ $match: { 'items.damageType': damageType } });
    }
    if (damageDiscoveredAt && damageDiscoveredAt !== 'all') {
      pipeline.push({ $match: { 'items.damageDiscoveredAt': damageDiscoveredAt } });
    }
    if (damageResolution && damageResolution !== 'all') {
      pipeline.push({ $match: { 'items.damageResolution': damageResolution } });
    }

    if (search && search.trim()) {
      const term = search.trim();
      pipeline.push({
        $match: {
          $or: [
            { caseNumber: { $regex: term, $options: 'i' } },
            { billNumber: { $regex: term, $options: 'i' } },
            { 'items.productNameSnapshot': { $regex: term, $options: 'i' } },
            { 'items.skuSnapshot': { $regex: term, $options: 'i' } },
            { 'customerSnapshot.name': { $regex: term, $options: 'i' } },
          ],
        },
      });
    }

    const facetPipeline = [
      ...pipeline,
      {
        $facet: {
          metrics: [
            {
              $group: {
                _id: null,
                totalDamagedQty: { $sum: '$items.processedQty' },
                totalLossValue: { $sum: { $multiply: ['$items.processedQty', '$items.unitPrice'] } },
                scrappedCount: {
                  $sum: { $cond: [{ $eq: ['$items.damageResolution', 'scrap'] }, '$items.processedQty', 0] },
                },
                vendorClaimCount: {
                  $sum: { $cond: [{ $eq: ['$items.damageResolution', 'vendor_claim'] }, '$items.processedQty', 0] },
                },
                totalRecords: { $sum: 1 },
              },
            },
          ],
          paginatedItems: [
            { $sort: { createdAt: -1 } },
            { $skip: (parseInt(page, 10) - 1) * parseInt(limit, 10) },
            { $limit: parseInt(limit, 10) },
            {
              $project: {
                caseId: '$_id',
                caseNumber: '$caseNumber',
                billNumber: '$billNumber',
                invoiceNumber: '$invoiceNumber',
                customerName: '$customerSnapshot.name',
                customerPhone: '$customerSnapshot.phone',
                caseStatus: '$status',
                createdAt: '$createdAt',
                itemId: '$items._id',
                productId: '$items.product',
                productName: '$items.productNameSnapshot',
                sku: '$items.skuSnapshot',
                image: '$items.image',
                quantity: '$items.processedQty',
                unitPrice: '$items.unitPrice',
                totalLoss: { $multiply: ['$items.processedQty', '$items.unitPrice'] },
                damageType: '$items.damageType',
                damageDiscoveredAt: '$items.damageDiscoveredAt',
                damageResolution: '$items.damageResolution',
                reasonText: '$items.reasonText',
                notes: '$items.notes',
                images: '$items.images',
              },
            },
          ],
        },
      },
    ];

    const [result] = await ReturnExchange.aggregate(facetPipeline);
    const metrics = result?.metrics?.[0] || {
      totalDamagedQty: 0,
      totalLossValue: 0,
      scrappedCount: 0,
      vendorClaimCount: 0,
      totalRecords: 0,
    };
    const items = result?.paginatedItems || [];

    return {
      metrics,
      items,
      total: metrics.totalRecords,
      page: parseInt(page, 10),
      totalPages: Math.ceil(metrics.totalRecords / parseInt(limit, 10)),
    };
  },

};
