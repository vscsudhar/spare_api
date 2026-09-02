import AppError from '../../errors/AppError.js';
import Order from './orders.model.js';
import Cart from '../cart/cart.model.js';
import Coupon from '../cart/coupons.model.js';
import Addresses from '../addresses/addresses.model.js';
import Products from '../products/products.model.js';
import Users from '../users/users.model.js';
import { InventoryItem, StockMovement } from '../inventory/inventory.model.js';
import { runInTransaction } from '../../utils/transaction.js';
import ReturnCancelRequest from './returnRequests.model.js';
import notificationsService from '../notifications/notifications.service.js';
import Settings from '../settings/settings.model.js';

export const ordersService = {
  /**
   * Validate Cart calculations prior to placing the order
   */
  validateCheckout: async (userId, addressId) => {
    const cart = await Cart.findOne({ user: userId }).populate('items.product').populate('coupon');
    if (!cart || cart.items.length === 0) {
      throw new AppError('Cart is empty.', 400);
    }

    const address = await Addresses.findOne({ _id: addressId, user: userId });
    if (!address) {
      throw new AppError('Shipping address not found.', 404);
    }

    let subTotal = 0;
    let taxAmount = 0;

    for (const item of cart.items) {
      if (!item.product || item.product.isDeleted) {
        throw new AppError('One of the products in your cart is no longer available.', 400);
      }
      if (!item.product.active) {
        throw new AppError(`Product ${item.product.name} is currently inactive.`, 400);
      }

      const lineSubTotal = item.quantity * item.product.sellingPrice;
      const lineTax = lineSubTotal * ((item.product.taxPercentage || 18) / 100);

      subTotal += lineSubTotal;
      taxAmount += lineTax;
    }

    let discountAmount = 0;
    if (cart.coupon) {
      const coupon = cart.coupon;
      if (coupon.isValid(subTotal)) {
        if (coupon.discountType === 'flat') {
          discountAmount = coupon.discountValue;
        } else if (coupon.discountType === 'percentage') {
          discountAmount = subTotal * (coupon.discountValue / 100);
          if (coupon.maxDiscountAmount) {
            discountAmount = Math.min(discountAmount, coupon.maxDiscountAmount);
          }
        }
        discountAmount = Math.min(discountAmount, subTotal);
      }
    }

    const deliveryFee = subTotal >= 1000 ? 0 : 100;
    const grandTotal = subTotal + taxAmount + deliveryFee - discountAmount;

    return {
      subTotal,
      taxAmount,
      discountAmount,
      deliveryFee,
      grandTotal,
      couponCode: cart.coupon ? cart.coupon.code : null,
      itemsCount: cart.items.length,
    };
  },

  /**
   * Create an Order with Server-side pricing verification, atomic stock deductions, and duplicate protection.
   */
  createOrder: async (userId, data, clientIdempotencyKey = null) => {
    // 1. Idempotency duplicate checks
    if (clientIdempotencyKey) {
      const existingOrder = await Order.findOne({ idempotencyKey: clientIdempotencyKey })
        .populate('user')
        .populate('items.product');
      if (existingOrder) {
        console.log(`🛡️ Duplicate order request caught by Idempotency Key: ${clientIdempotencyKey}`);
        return existingOrder;
      }
    }

    return runInTransaction(async (session) => {
      // 2. Fetch User Cart
      const cart = await Cart.findOne({ user: userId })
        .populate('items.product')
        .populate('coupon')
        .session(session);

      if (!cart || cart.items.length === 0) {
        throw new AppError('Cart is empty.', 400);
      }

      // 3. Fetch Shipping Address
      const address = await Addresses.findOne({ _id: data.addressId, user: userId }).session(session);
      if (!address) {
        throw new AppError('Shipping address not found.', 404);
      }

      // 4. Calculate Server-side pricing & Snapshots list
      let subTotal = 0;
      let taxAmount = 0;
      const orderItems = [];

      for (const item of cart.items) {
        const product = await Products.findById(item.product._id).session(session);
        if (!product || product.isDeleted) {
          throw new AppError('One of the products in your cart is no longer available.', 400);
        }
        if (!product.active) {
          throw new AppError(`Product ${product.name} is currently inactive.`, 400);
        }

        // Concurrency Stock Validation (Atomic)
        if (product.currentStock < item.quantity) {
          throw new AppError(
            `Insufficient stock for ${product.name}. Available: ${product.currentStock}, requested: ${item.quantity}`,
            400
          );
        }

        const lineSubTotal = item.quantity * product.sellingPrice;
        const lineTax = lineSubTotal * ((product.taxPercentage || 18) / 100);
        const lineTotal = lineSubTotal + lineTax;

        subTotal += lineSubTotal;
        taxAmount += lineTax;

        orderItems.push({
          product: product._id,
          productSnapshot: {
            name: product.name,
            sku: product.sku,
            slug: product.slug,
            sellingPrice: product.sellingPrice,
            purchasePrice: product.purchasePrice,
            mrp: product.mrp,
            image: product.images[0]?.url || '',
          },
          quantity: item.quantity,
          unitPrice: product.sellingPrice,
          taxPercentage: product.taxPercentage || 18,
          totalPrice: lineTotal,
        });
      }

      // 5. Apply Coupon
      let discountAmount = 0;
      if (cart.coupon) {
        const coupon = await Coupon.findById(cart.coupon._id).session(session);
        if (coupon && coupon.isValid(subTotal)) {
          if (coupon.discountType === 'flat') {
            discountAmount = coupon.discountValue;
          } else if (coupon.discountType === 'percentage') {
            discountAmount = subTotal * (coupon.discountValue / 100);
            if (coupon.maxDiscountAmount) {
              discountAmount = Math.min(discountAmount, coupon.maxDiscountAmount);
            }
          }
          discountAmount = Math.min(discountAmount, subTotal);
          
          // Increment usage count
          coupon.usageCount += 1;
          await coupon.save({ session });
        }
      }

      const deliveryFee = subTotal >= 1000 ? 0 : 100;
      const grandTotal = subTotal + taxAmount + deliveryFee - discountAmount;
      const orderNumber = `ORD-${Math.floor(100000 + Math.random() * 900000)}`;

      // 6. Deduct Stock Levels atomically inside Session to prevent double spending
      for (const item of cart.items) {
        // Atomic product update ensures stock currentStock >= quantity
        const productUpdate = await Products.findOneAndUpdate(
          {
            _id: item.product._id,
            currentStock: { $gte: item.quantity },
            isDeleted: { $ne: true },
          },
          { $inc: { currentStock: -item.quantity } },
          { session, new: true }
        );

        if (!productUpdate) {
          throw new AppError(
            `Stock conflict for product: ${item.product.name}. Inventory allocation failed.`,
            400
          );
        }

        // Low stock warning trigger
        const settings = (await Settings.findOne().session(session)) || {};
        const threshold = settings.inventory?.lowStockThreshold ?? 10;
        if (productUpdate.currentStock < threshold) {
          try {
            await notificationsService.createNotification(null, {
              title: 'Low Stock Alert',
              message: `Product "${productUpdate.name}" is running low on stock. Current level: ${productUpdate.currentStock}`,
              type: 'low_stock',
              referenceId: productUpdate._id,
              referenceType: 'Product',
            });
          } catch (err) {
            console.error('Failed to trigger low stock notification:', err);
          }
        }

        // Sync InventoryItem stock
        await InventoryItem.findOneAndUpdate(
          { product: item.product._id, currentStock: { $gte: item.quantity } },
          { $inc: { currentStock: -item.quantity } },
          { session }
        );

        // Record stock movements
        await StockMovement.create(
          [
            {
              product: item.product._id,
              type: 'sale',
              quantity: -item.quantity,
              referenceType: 'Order',
              notes: `Order checkout mapping: ${orderNumber}`,
              user: userId,
            },
          ],
          { session }
        );
      }

      // 7. Save Address Snapshots
      const shippingAddress = {
        recipientName: address.recipientName,
        phone: address.phone,
        addressLine1: address.addressLine1,
        addressLine2: address.addressLine2,
        city: address.city,
        state: address.state,
        postalCode: address.postalCode,
        country: address.country,
      };

      // 8. Place the Order doc
      const order = await Order.create(
        [
          {
            orderNumber,
            user: userId,
            items: orderItems,
            shippingAddress,
            subTotal,
            taxAmount,
            discountAmount,
            deliveryFee,
            grandTotal,
            couponCode: cart.coupon ? cart.coupon.code : null,
            idempotencyKey: clientIdempotencyKey || undefined,
            statusHistory: [{ status: 'pending', notes: 'Order placed successfully' }],
          },
        ],
        { session }
      );

      // 9. Clear Cart purchased items
      cart.items = [];
      cart.coupon = null;
      await cart.save({ session });

      // Trigger new_order notification
      try {
        await notificationsService.createNotification(null, {
          title: 'New Order Placed',
          message: `Order ${orderNumber} has been placed. Amount: ₹${(grandTotal / 100).toFixed(2)}`,
          type: 'new_order',
          referenceId: order[0]._id,
          referenceType: 'Order',
        });
      } catch (err) {
        console.error('Failed to create new order notification:', err);
      }

      return order[0];
    });
  },

  /**
   * Get logged-in user order listings
   */
  getMyOrders: async (userId) => {
    return Order.find({ user: userId }).populate('items.product').sort({ createdAt: -1 });
  },

  /**
   * Get specific logged-in user order detail
   */
  getMyOrderById: async (userId, orderId) => {
    const order = await Order.findOne({ _id: orderId, user: userId }).populate('items.product');
    if (!order) {
      throw new AppError('Order not found.', 404);
    }
    return order;
  },

  /**
   * Cancel own order (Allowed if status is pending/confirmed/processing)
   */
  cancelMyOrder: async (userId, orderId) => {
    const order = await Order.findOne({ _id: orderId, user: userId });
    if (!order) {
      throw new AppError('Order not found.', 404);
    }

    const cancelableStatuses = ['pending', 'confirmed', 'processing'];
    if (!cancelableStatuses.includes(order.status)) {
      throw new AppError(`Cannot cancel order in ${order.status} stage.`, 400);
    }

    return runInTransaction(async (session) => {
      order.status = 'cancelled';
      order.statusHistory.push({
        status: 'cancelled',
        changedBy: userId,
        notes: 'Order cancelled by customer',
      });
      await order.save({ session });

      // Create ReturnCancelRequest audit log
      await ReturnCancelRequest.create(
        [
          {
            order: orderId,
            user: userId,
            type: 'cancel',
            reason: 'Cancelled by customer',
            status: 'approved',
            items: order.items.map((item) => ({
              product: item.product,
              quantity: item.quantity,
            })),
            actionedBy: userId,
            actionedAt: new Date(),
          },
        ],
        { session }
      );

      // Restore Stock quantities
      for (const item of order.items) {
        await Products.findByIdAndUpdate(item.product, { $inc: { currentStock: item.quantity } }, { session });
        await InventoryItem.findOneAndUpdate({ product: item.product }, { $inc: { currentStock: item.quantity } }, { session });

        await StockMovement.create(
          [
            {
              product: item.product,
              type: 'return',
              quantity: item.quantity,
              referenceType: 'Order',
              referenceId: orderId,
              notes: `Order cancellation restore: ${order.orderNumber}`,
              user: userId,
            },
          ],
          { session }
        );
      }

      return order;
    });
  },

  /**
   * Administrative Order list
   */
  adminGetAll: async () => {
    return Order.find().populate('user').sort({ createdAt: -1 });
  },

  /**
   * Administrative Order details
   */
  adminGetById: async (id) => {
    const order = await Order.findById(id).populate('user').populate('items.product').populate('deliveryAssignment.driver');
    if (!order) {
      throw new AppError('Order not found.', 404);
    }
    return order;
  },

  /**
   * Administrative order status updates
   */
  adminUpdateStatus: async (id, status, notes = '', changedByUserId) => {
    const order = await Order.findById(id);
    if (!order) {
      throw new AppError('Order not found.', 404);
    }

    if (order.status === status) {
      return order;
    }

    return runInTransaction(async (session) => {
      const oldStatus = order.status;
      order.status = status;
      order.statusHistory.push({
        status,
        changedBy: changedByUserId,
        notes: notes || `Order status updated to ${status}`,
      });

      // If transitioning to cancelled, restore stocks
      if (status === 'cancelled' && oldStatus !== 'cancelled') {
        for (const item of order.items) {
          await Products.findByIdAndUpdate(item.product, { $inc: { currentStock: item.quantity } }, { session });
          await InventoryItem.findOneAndUpdate({ product: item.product }, { $inc: { currentStock: item.quantity } }, { session });

          await StockMovement.create(
            [
              {
                product: item.product,
                type: 'return',
                quantity: item.quantity,
                referenceType: 'Order',
                referenceId: id,
                notes: `Order cancellation restore: ${order.orderNumber}`,
                user: changedByUserId,
              },
            ],
            { session }
          );
        }
      }

      // Log ReturnCancelRequest if status updates to cancelled or returned
      if ((status === 'cancelled' || status === 'returned') && oldStatus !== status) {
        await ReturnCancelRequest.create(
          [
            {
              order: id,
              user: order.user,
              type: status === 'cancelled' ? 'cancel' : 'return',
              reason: notes || `Order updated to ${status} by admin`,
              status: 'approved',
              items: order.items.map((item) => ({
                product: item.product,
                quantity: item.quantity,
              })),
              actionedBy: changedByUserId,
              actionedAt: new Date(),
              adminNotes: notes,
            },
          ],
          { session }
        );
      }

      await order.save({ session });

      // Trigger order status notification
      try {
        await notificationsService.createNotification(order.user, {
          title: 'Order Status Updated',
          message: `Your order ${order.orderNumber} status has been updated to "${status}".`,
          type: 'order_status',
          referenceId: order._id,
          referenceType: 'Order',
        });
      } catch (err) {
        console.error('Failed to trigger order status notification:', err);
      }

      return order;
    });
  },

  /**
   * Assign driver to deliver order
   */
  adminAssignDelivery: async (id, driverId, notes = '') => {
    const order = await Order.findById(id);
    if (!order) {
      throw new AppError('Order not found.', 404);
    }

    const driver = await Users.findById(driverId).populate('role');
    if (!driver || driver.role.name !== 'delivery_staff') {
      throw new AppError('Selected user is not registered as delivery staff.', 400);
    }

    order.deliveryAssignment = {
      driver: driverId,
      status: 'assigned',
      notes,
      assignedAt: new Date(),
    };

    order.statusHistory.push({
      status: order.status, // keep current status
      notes: `Delivery driver assigned: ${driver.name}`,
    });

    return order.save();
  },

  /**
   * Append administrative notes log
   */
  adminAddNote: async (id, text, userId) => {
    const order = await Order.findById(id);
    if (!order) {
      throw new AppError('Order not found.', 404);
    }

    order.notes.push({ text, user: userId });
    return order.save();
  },
};

export default ordersService;
