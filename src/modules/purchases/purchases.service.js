import AppError from '../../errors/AppError.js';
import PurchaseOrder, { PurchaseReceipt, PurchasePayment } from './purchases.model.js';
import Supplier from '../suppliers/suppliers.model.js';
import Products from '../products/products.model.js';
import inventoryService from '../inventory/inventory.service.js';
import { runInTransaction } from '../../utils/transaction.js';
import notificationsService from '../notifications/notifications.service.js';

// Random code generators
const generateCode = (prefix) => {
  return `${prefix}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
};

export const purchasesService = {
  /**
   * List all purchase orders
   */
  getAll: async () => {
    return PurchaseOrder.find().populate('supplier').populate('user');
  },

  /**
   * Get purchase order by ID
   */
  getById: async (id) => {
    const po = await PurchaseOrder.findById(id)
      .populate('supplier')
      .populate('user')
      .populate('items.product');

    if (!po) {
      throw new AppError('Purchase order not found.', 404);
    }
    return po;
  },

  /**
   * Create a new purchase order (draft)
   */
  create: async (poData, userId) => {
    // Verify supplier exists
    const supplier = await Supplier.findById(poData.supplier);
    if (!supplier) {
      throw new AppError('Supplier not found.', 404);
    }

    // Verify products and calculate totals
    let subTotal = 0;
    let taxAmount = 0;
    const validatedItems = [];

    for (const item of poData.items) {
      const product = await Products.findById(item.product);
      if (!product) {
        throw new AppError(`Product with ID ${item.product} not found.`, 404);
      }

      const lineSubTotal = item.quantity * item.unitPrice;
      const lineTax = lineSubTotal * ((item.taxPercentage || 18) / 100);

      subTotal += lineSubTotal;
      taxAmount += lineTax;

      validatedItems.push({
        product: item.product,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        taxPercentage: item.taxPercentage || 18,
        quantityReceived: 0,
      });
    }

    const grandTotal = subTotal + taxAmount;
    const poNumber = generateCode('PO');

    return PurchaseOrder.create({
      poNumber,
      supplier: poData.supplier,
      items: validatedItems,
      subTotal,
      taxAmount,
      grandTotal,
      notes: poData.notes,
      expectedDeliveryDate: poData.expectedDeliveryDate,
      user: userId,
      status: 'draft',
    });
  },

  /**
   * Update Purchase Order (only allowed in draft status)
   */
  update: async (id, poData) => {
    const po = await PurchaseOrder.findById(id);
    if (!po) {
      throw new AppError('Purchase order not found.', 404);
    }

    if (po.status !== 'draft') {
      throw new AppError(`Cannot edit a purchase order in ${po.status} status.`, 400);
    }

    if (poData.supplier) {
      const supplier = await Supplier.findById(poData.supplier);
      if (!supplier) {
        throw new AppError('Supplier not found.', 404);
      }
      po.supplier = poData.supplier;
    }

    if (poData.items) {
      let subTotal = 0;
      let taxAmount = 0;
      const validatedItems = [];

      for (const item of poData.items) {
        const product = await Products.findById(item.product);
        if (!product) {
          throw new AppError(`Product with ID ${item.product} not found.`, 404);
        }

        const lineSubTotal = item.quantity * item.unitPrice;
        const lineTax = lineSubTotal * ((item.taxPercentage || 18) / 100);

        subTotal += lineSubTotal;
        taxAmount += lineTax;

        validatedItems.push({
          product: item.product,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          taxPercentage: item.taxPercentage || 18,
          quantityReceived: 0,
        });
      }

      po.items = validatedItems;
      po.subTotal = subTotal;
      po.taxAmount = taxAmount;
      po.grandTotal = subTotal + taxAmount;
    }

    if (poData.notes !== undefined) {
      po.notes = poData.notes;
    }

    if (poData.expectedDeliveryDate !== undefined) {
      po.expectedDeliveryDate = poData.expectedDeliveryDate;
    }

    return po.save();
  },

  /**
   * Update PO Status
   */
  updateStatus: async (id, status) => {
    const po = await PurchaseOrder.findById(id);
    if (!po) {
      throw new AppError('Purchase order not found.', 404);
    }

    po.status = status;
    return po.save();
  },

  /**
   * Receive goods on a purchase order (complete or partial)
   * Triggers stock updates, movements, and updates supplier balance in a transaction.
   */
  receiveReceipt: async (poId, receiptData, userId) => {
    // Run the receipt updates within a transaction session
    return runInTransaction(async (session) => {
      // 1. Fetch Purchase Order
      const po = await PurchaseOrder.findById(poId).session(session);
      if (!po) {
        throw new AppError('Purchase order not found.', 404);
      }

      const validReceiptStatuses = ['approved', 'ordered', 'partially_received'];
      if (!validReceiptStatuses.includes(po.status)) {
        throw new AppError(`Cannot receive items on a purchase order in ${po.status} status.`, 400);
      }

      // 2. Process received items and calculate costs
      const receiptItems = [];
      let totalReceivedValue = 0;

      for (const item of receiptData.items) {
        const poItem = po.items.find((el) => el.product.toString() === item.product);
        if (!poItem) {
          throw new AppError(`Product ${item.product} is not part of this purchase order.`, 400);
        }

        // Prevent receiving excess quantity
        const remainingToReceive = poItem.quantity - poItem.quantityReceived;
        if (item.quantityReceived > remainingToReceive) {
          throw new AppError(
            `Cannot receive ${item.quantityReceived} items for product ID ${item.product}. Only ${remainingToReceive} items are remaining to be received.`,
            400
          );
        }

        // Update PO item quantityReceived
        poItem.quantityReceived += item.quantityReceived;

        // Calculate line value for supplier outstanding balance (Price + Tax)
        const lineCost = item.quantityReceived * poItem.unitPrice;
        const lineTax = lineCost * (poItem.taxPercentage / 100);
        totalReceivedValue += lineCost + lineTax;

        receiptItems.push({
          product: item.product,
          quantityReceived: item.quantityReceived,
        });
      }

      // 3. Determine new PO status
      const allReceived = po.items.every((el) => el.quantityReceived === el.quantity);
      po.status = allReceived ? 'received' : 'partially_received';
      await po.save({ session });

      // 4. Create PurchaseReceipt document
      const receiptNumber = generateCode('PR');
      const receipt = await PurchaseReceipt.create(
        [
          {
            receiptNumber,
            purchaseOrder: poId,
            items: receiptItems,
            receivedBy: userId,
          },
        ],
        { session }
      );

      const receiptId = receipt[0]._id;

      // 5. Update Inventory and log StockMovements
      for (const item of receiptItems) {
        await inventoryService.updateStock(
          item.product,
          'purchase',
          item.quantityReceived,
          'PurchaseReceipt',
          receiptId,
          userId,
          `Received items via Receipt ${receiptNumber}`,
          session
        );
      }

      // 6. Update Supplier Payable outstandingBalance
      const supplier = await Supplier.findById(po.supplier).session(session);
      if (supplier) {
        supplier.outstandingBalance += totalReceivedValue;
        await supplier.save({ session });
      }

      // Trigger Purchase Received notification
      try {
        await notificationsService.createNotification(null, {
          title: 'Purchase Order Received',
          message: `Items received for purchase order ${po.poNumber}.`,
          type: 'purchase_received',
          referenceId: po._id,
          referenceType: 'PurchaseOrder',
        });
      } catch (err) {
        console.error('Failed to trigger purchase received notification:', err);
      }

      // Trigger Supplier Payment Due notification if dues are updated
      if (supplier && totalReceivedValue > 0) {
        try {
          await notificationsService.createNotification(null, {
            title: 'Supplier Payment Due',
            message: `Outstanding dues updated for supplier "${supplier.name}". Outstanding balance: ₹${(supplier.outstandingBalance / 100).toFixed(2)}`,
            type: 'supplier_payment_due',
            referenceId: supplier._id,
            referenceType: 'Supplier',
          });
        } catch (err) {
          console.error('Failed to trigger supplier payment due notification:', err);
        }
      }

      return receipt[0];
    });
  },

  /**
   * Record a payment against a Purchase Order
   */
  createPayment: async (poId, paymentData) => {
    const po = await PurchaseOrder.findById(poId);
    if (!po) {
      throw new AppError('Purchase order not found.', 404);
    }

    const paymentNumber = generateCode('PP');

    // 1. Record PO Payment doc
    const payment = await PurchasePayment.create({
      paymentNumber,
      purchaseOrder: poId,
      amount: paymentData.amount,
      paymentMethod: paymentData.paymentMethod,
      transactionReference: paymentData.transactionReference,
      notes: paymentData.notes,
    });

    // 2. Update Supplier outstandingBalance (payments decrease balance)
    const supplier = await Supplier.findById(po.supplier);
    if (supplier) {
      supplier.outstandingBalance -= paymentData.amount;
      await supplier.save();
    }

    return payment;
  },

  /**
   * Delete Purchase Order (only allowed in draft or cancelled status)
   */
  delete: async (id) => {
    const po = await PurchaseOrder.findById(id);
    if (!po) {
      throw new AppError('Purchase order not found.', 404);
    }

    const deletableStatuses = ['draft', 'cancelled'];
    if (!deletableStatuses.includes(po.status)) {
      throw new AppError(`Cannot delete a purchase order in ${po.status} status.`, 400);
    }

    await PurchaseOrder.findByIdAndDelete(id);
  },
};

export default purchasesService;
