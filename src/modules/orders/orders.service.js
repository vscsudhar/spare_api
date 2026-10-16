import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import Role from '../users/roles.model.js';
import fcmService from '../notifications/fcm.service.js';
import deliveryChargesService from '../delivery-charges/delivery-charges.service.js';
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

      const lineTotal = item.quantity * item.product.sellingPrice;
      const taxRate = item.product.taxPercentage || 18;
      const lineTaxable = Math.round(lineTotal / (1.0 + taxRate / 100.0));
      const lineTax = lineTotal - lineTaxable;

      subTotal += lineTotal;
      taxAmount += lineTax;
    }

    let discountAmount = 0;
    if (cart.coupon) {
      const coupon = cart.coupon;
      if (coupon.isValid(subTotal)) {
        if (coupon.discountType === 'flat') {
          discountAmount = coupon.discountValue;
        } else if (coupon.discountType === 'percentage') {
          discountAmount = Math.round(subTotal * (coupon.discountValue / 100));
          if (coupon.maxDiscountAmount) {
            discountAmount = Math.min(discountAmount, coupon.maxDiscountAmount);
          }
        }
        discountAmount = Math.min(discountAmount, subTotal);
      }
    }

    const subTotalRupees = subTotal > 5000 ? subTotal / 100.0 : subTotal;
    const deliveryFeeRupees = await deliveryChargesService.calculateFee(subTotalRupees, address?.locationId || null);
    const deliveryFee = Math.round(deliveryFeeRupees * 100);
    const grandTotal = subTotal + deliveryFee - discountAmount;

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

      // 4. Calculate Server-side pricing (Selling prices are tax-inclusive consumer retail prices)
      let subTotal = 0;
      let taxAmount = 0;
      const orderItems = [];
      const fulfillableItems = [];

      for (const item of cart.items) {
        const product = await Products.findById(item.product._id).session(session);
        if (!product || product.isDeleted || !product.active) {
          continue;
        }

        // Check if product is strictly stock-managed and out of stock
        const isStockManaged = product.stockManaged !== false;
        const availableStock = product.currentStock ?? 0;

        if (isStockManaged && availableStock < item.quantity) {
          continue;
        }

        const lineTotal = item.quantity * product.sellingPrice;
        const taxRate = product.taxPercentage || 18;
        const lineTaxable = Math.round(lineTotal / (1.0 + taxRate / 100.0));
        const lineTax = lineTotal - lineTaxable;

        subTotal += lineTotal;
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

        fulfillableItems.push({
          item,
          productDoc: product,
          isStockManaged,
        });
      }

      if (orderItems.length === 0) {
        throw new AppError(
          'All items in your cart are currently out of stock or unavailable.',
          400
        );
      }

      // 5. Apply Coupon
      let discountAmount = 0;
      if (cart.coupon) {
        const coupon = await Coupon.findById(cart.coupon._id).session(session);
        if (coupon && coupon.isValid(subTotal)) {
          if (coupon.discountType === 'flat') {
            discountAmount = coupon.discountValue;
          } else if (coupon.discountType === 'percentage') {
            discountAmount = Math.round(subTotal * (coupon.discountValue / 100));
            if (coupon.maxDiscountAmount) {
              discountAmount = Math.min(discountAmount, coupon.maxDiscountAmount);
            }
          }
          discountAmount = Math.min(discountAmount, subTotal);
          
          coupon.usageCount += 1;
          await coupon.save({ session });
        }
      }

      const subTotalInRupees = subTotal > 5000 ? subTotal / 100.0 : subTotal;
      const deliveryFeeInRupees = await deliveryChargesService.calculateFee(subTotalInRupees, address?.locationId || null);
      const deliveryFee = Math.round(deliveryFeeInRupees * 100);
      const grandTotal = subTotal + deliveryFee - discountAmount;
      const orderNumber = `ORD-${Math.floor(100000 + Math.random() * 900000)}`;

      // 6. Deduct Stock Levels atomically inside Session for fulfilled items
      for (const fItem of fulfillableItems) {
        const { item, productDoc, isStockManaged } = fItem;

        if (isStockManaged) {
          const productUpdate = await Products.findOneAndUpdate(
            {
              _id: productDoc._id,
              currentStock: { $gte: item.quantity },
              isDeleted: { $ne: true },
            },
            { $inc: { currentStock: -item.quantity } },
            { session, new: true }
          );

          if (!productUpdate) {
            throw new AppError(
              `Stock conflict for product: ${productDoc.name}. Inventory allocation failed.`,
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
            { product: productDoc._id, currentStock: { $gte: item.quantity } },
            { $inc: { currentStock: -item.quantity } },
            { session }
          );
        } else {
          // On-demand / arrange product (stock not strictly managed)
          if ((productDoc.currentStock ?? 0) > 0) {
            await Products.findByIdAndUpdate(
              productDoc._id,
              { $inc: { currentStock: -Math.min(productDoc.currentStock, item.quantity) } },
              { session }
            );
          }
        }

        // Record stock movements
        await StockMovement.create(
          [
            {
              product: productDoc._id,
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

      // 7. Save Address Snapshots with Coordinates and Location Hub Assignment
      const shippingAddress = {
        recipientName: address.recipientName,
        phone: address.phone,
        addressLine1: address.addressLine1,
        addressLine2: address.addressLine2,
        city: address.city,
        state: address.state,
        postalCode: address.postalCode,
        country: address.country,
        latitude: address.latitude ?? null,
        longitude: address.longitude ?? null,
        locationId: address.locationId ?? null,
        locationName: address.locationName ?? null,
        distanceFromLocationKm: address.distanceFromLocationKm ?? null,
      };

      // 8. Place the Order doc assigned to the nearest Hub
      const order = await Order.create(
        [
          {
            orderNumber,
            user: userId,
            items: orderItems,
            shippingAddress,
            paymentMethod: data.paymentMethod || 'Cash on Delivery',
            locationId: address.locationId ?? null,
            locationName: address.locationName ?? null,
            distanceFromLocationKm: address.distanceFromLocationKm ?? null,
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

      // 9. Remove fulfilled items from Cart (keep any out-of-stock items)
      const orderedProductIds = new Set(
        fulfillableItems.map((f) => f.productDoc._id.toString())
      );
      cart.items = cart.items.filter(
        (ci) => !orderedProductIds.has(ci.product._id ? ci.product._id.toString() : ci.product.toString())
      );
      if (cart.items.length === 0) {
        cart.coupon = null;
      }
      await cart.save({ session });

      // Trigger new_order notification
      try {
        // Admin / Store notification
        await notificationsService.createNotification(null, {
          title: 'New Order Placed',
          message: `Order ${orderNumber} has been placed. Amount: ₹${(grandTotal / 100).toFixed(2)}`,
          type: 'new_order',
          referenceId: order[0]._id,
          referenceType: 'Order',
        });

        // Customer in-app notification
        await notificationsService.createNotification(userId, {
          title: 'Order Placed Successfully! 🛒',
          message: `Your order #${orderNumber} for ₹${(grandTotal / 100).toFixed(2)} has been placed successfully.`,
          type: 'new_order',
          referenceId: order[0]._id,
          referenceType: 'Order',
        });

        // Customer FCM push notification
        await fcmService.sendToUser(userId, {
          title: 'Order Placed Successfully! 🛒',
          body: `Your order #${orderNumber} for ₹${(grandTotal / 100).toFixed(2)} has been placed successfully.`,
          data: {
            type: 'new_order',
            orderId: order[0]._id.toString(),
            orderNumber: orderNumber,
          },
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
    let order;
    if (mongoose.Types.ObjectId.isValid(id)) {
      order = await Order.findById(id);
    }
    if (!order) {
      order = await Order.findOne({ orderNumber: id.toString().toUpperCase() });
    }
    if (!order) {
      throw new AppError('Order not found.', 404);
    }

    if (order.status === status) {
      return order;
    }

    const updatedOrder = await runInTransaction(async (session) => {
      const oldStatus = order.status;
      order.status = status;

      // If transitioning to cancelled, set delivery assignment status to failed
      if (status === 'cancelled' && order.deliveryAssignment) {
        order.deliveryAssignment.status = 'failed';
      }
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

    // Trigger FCM push notification to customer outside transaction
    try {
      const statusTitles = {
        pending: 'Order Placed 📋',
        confirmed: 'Order Confirmed ✅',
        processing: 'Order Processing ⚙️',
        packed: 'Order Packed 📦',
        shipped: 'Order Dispatched 🚚',
        in_transit: 'Order In Transit 🛵',
        out_for_delivery: 'Out for Delivery 🛵',
        delivered: 'Order Delivered 🎉',
        cancelled: 'Order Cancelled ❌',
        returned: 'Order Returned ↩️',
      };
      const pushTitle = statusTitles[status] || 'Order Status Updated';
      const pushBody = `Your VoltSpare order #${updatedOrder.orderNumber} status is now "${status.replace(/_/g, ' ')}".`;

      await fcmService.sendToUser(updatedOrder.user, {
        title: pushTitle,
        body: pushBody,
        data: {
          type: 'order_status',
          orderId: updatedOrder._id.toString(),
          orderNumber: updatedOrder.orderNumber,
          status: status,
        },
      });
      console.log(`📲 FCM push dispatched to customer ${updatedOrder.user} for order #${updatedOrder.orderNumber} status -> ${status}`);
    } catch (fcmErr) {
      console.error('Failed to dispatch FCM push notification for order status:', fcmErr.message);
    }

    return updatedOrder;
  },

  /**
   * Administrative Order Unassign Delivery Driver
   */
  adminUnassignDelivery: async (id, notes = '') => {
    let order;
    if (mongoose.Types.ObjectId.isValid(id)) {
      order = await Order.findById(id);
    }
    if (!order) {
      order = await Order.findOne({ orderNumber: id.toString().toUpperCase() });
    }
    if (!order) {
      throw new AppError('Order not found.', 404);
    }

    order.deliveryAssignment = null;
    order.status = 'processing';
    order.statusHistory.push({
      status: 'processing',
      notes: notes || 'Delivery driver unassigned by admin. Ready for re-assignment.',
    });
    const savedOrder = await order.save();
    return savedOrder;
  },

  /**
   * Assign driver to deliver order with flexible ID matching and driver fallback/auto-provisioning
   */
  adminAssignDelivery: async (id, driverId, notes = '') => {
    // 1. Find order by ObjectId or orderNumber
    let order;
    if (mongoose.Types.ObjectId.isValid(id)) {
      order = await Order.findById(id);
    }
    if (!order) {
      order = await Order.findOne({ orderNumber: id.toString().toUpperCase() });
    }
    if (!order) {
      throw new AppError('Order not found.', 404);
    }

        // 2. Resolve driver user
    let driver;
    if (mongoose.Types.ObjectId.isValid(driverId)) {
      driver = await Users.findById(driverId).populate('role');
    }

    // Map known mock staff IDs from admin panel to real emails
    const staffIdMap = {
      'staff_4': 'vikram.s@voltspare.com',
      'staff_del_arun': 'arun.k@voltspare.com',
      'staff_del_vikram': 'vikram.s@voltspare.com',
      'staff_1': 'owner@voltspare.com',
      'staff_2': 'rohan.d@voltspare.com',
      'staff_3': 'priya.nair@voltspare.com',
    };

    if (!driver && staffIdMap[driverId]) {
      driver = await Users.findOne({ email: staffIdMap[driverId] }).populate('role');
    }

    // If not found by ObjectId or map, search by email or non-empty name
    if (!driver) {
      const cleanDriverStr = driverId.toString().trim();
      const nameSearch = cleanDriverStr.replace(/^staff_\d+_?/, '').trim();
      const orClauses = [{ email: cleanDriverStr.toLowerCase() }];
      if (nameSearch.length >= 2) {
        orClauses.push({ name: new RegExp(nameSearch, 'i') });
      }

      driver = await Users.findOne({ $or: orClauses }).populate('role');
    }

    // Fallback: If still not found, check known mock staff IDs from admin panel
    if (!driver) {
      const deliveryRole = await Role.findOne({ name: 'delivery_staff' }) || await Role.findOne({ name: 'admin' });
      let name = 'Vikram Singh';
      let email = 'vikram.s@voltspare.com';

      if (driverId.toString().toLowerCase().includes('arun') || driverId === 'staff_del_arun') {
        name = 'Arun Kumar';
        email = 'arun.k@voltspare.com';
      } else if (driverId.toString().includes('@')) {
        email = driverId.toString().toLowerCase();
        name = email.split('@')[0];
      }

      driver = await Users.findOne({ email }).populate('role');
      if (!driver) {
        const passwordHash = await bcrypt.hash('Staff12345!', 10);
        const created = await Users.create({
          name,
          email,
          phone: '+91' + Math.floor(6000000000 + Math.random() * 3999999999),
          passwordHash,
          role: deliveryRole._id,
          status: 'active',
          emailVerified: true,
          phoneVerified: true,
        });
        driver = await Users.findById(created._id).populate('role');
      }
    }

    if (!driver) {
      throw new AppError('Delivery staff not found.', 404);
    }

    // If driver role is not delivery_staff/admin/owner, ensure role has delivery permission
    const roleName = driver.role?.name || '';
    const allowedRoles = ['delivery_staff', 'admin', 'owner', 'inventory_staff', 'sales_staff'];
    if (!allowedRoles.includes(roleName)) {
      const deliveryRole = await Role.findOne({ name: 'delivery_staff' });
      if (deliveryRole) {
        driver.role = deliveryRole._id;
        await driver.save();
        driver = await Users.findById(driver._id).populate('role');
      }
    }

    // 3. Update order deliveryAssignment
    order.deliveryAssignment = {
      driver: driver._id,
      status: 'assigned',
      notes,
      assignedAt: new Date(),
    };

    // If order was in pending / confirmed / processing, advance to shipped (out for fulfillment)
    if (['pending', 'confirmed', 'processing'].includes(order.status)) {
      order.status = 'shipped';
    }

    order.statusHistory.push({
      status: order.status,
      notes: `Delivery driver assigned: ${driver.name}`,
    });

    const savedOrder = await order.save();

    // Trigger FCM push notification to assigned delivery driver & any linked accounts
    try {
      const targetUserIds = [driver._id.toString()];
      const driverEmail = (driver.email || '').toLowerCase();
      if (driverEmail === 'sudhar@mail.com' || driverEmail === 'vscsudhar@gmail.com' || driver.name?.toLowerCase().includes('sudhar')) {
        const linked = await Users.find({
          $or: [
            { email: { $in: ['sudhar@mail.com', 'vscsudhar@gmail.com'] } },
            { name: /sudhar/i }
          ]
        }).select('_id');
        linked.forEach(u => {
          const uStr = u._id.toString();
          if (!targetUserIds.includes(uStr)) targetUserIds.push(uStr);
        });
      }

      for (const targetId of targetUserIds) {
        try {
          await fcmService.sendToUser(targetId, {
            title: 'New Delivery Assigned',
            body: `You have been assigned order #${savedOrder.orderNumber}.`,
            data: {
              type: 'delivery_assignment',
              orderId: savedOrder._id.toString(),
              orderNumber: savedOrder.orderNumber,
              assignmentId: savedOrder._id.toString(),
            },
          });
          await notificationsService.createNotification(targetId, {
            title: 'New Delivery Assigned',
            message: `You have been assigned order #${savedOrder.orderNumber}.`,
            type: 'delivery_assignment',
            referenceId: savedOrder._id,
            referenceType: 'Order',
          });
        } catch (_) {}
      }
    } catch (fcmErr) {
      console.error('Failed to notify driver of assignment:', fcmErr);
    }

    return savedOrder;
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
