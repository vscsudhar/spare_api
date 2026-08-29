import Billing from './billing.model.js';
import Products from '../products/products.model.js';
import { InventoryItem, StockMovement } from '../inventory/inventory.model.js';
import Settings from '../settings/settings.model.js';
import AppError from '../../errors/AppError.js';
import { runInTransaction } from '../../utils/transaction.js';

export const billingService = {
  findById: async (id) => {
    return Billing.findById(id).populate('createdBy', 'name email');
  },

  getAll: async () => {
    return Billing.find().populate('createdBy', 'name email').sort({ createdAt: -1 });
  },

  /**
   * Preview POS calculations without altering database state
   */
  preview: async (items = [], discountAmount = 0, paymentAllocations = []) => {
    let subTotal = 0;
    const previewItems = [];

    for (const item of items) {
      const productId = item.productId || item.product;
      const product = await Products.findById(productId);
      if (!product || product.isDeleted) {
        throw new AppError(`Product not found: ${productId}`, 404);
      }

      const unitPrice = product.sellingPrice; // in paise
      const totalPrice = unitPrice * item.quantity;
      subTotal += totalPrice;

      previewItems.push({
        product: product._id,
        name: product.name,
        quantity: item.quantity,
        unitPrice,
        totalPrice,
      });
    }

    // Fetch billing parameters from settings
    const settings = (await Settings.findOne()) || {};
    const taxPercentage = settings.billing?.taxPercentage ?? 18;

    const taxAmount = Math.round(subTotal * (taxPercentage / 100.0));
    let grandTotal = subTotal + taxAmount - discountAmount;
    if (grandTotal < 0) grandTotal = 0;

    const amountPaid = paymentAllocations.reduce((sum, alloc) => sum + (alloc.amount || 0), 0);
    const remainingAmount = Math.max(0, grandTotal - amountPaid);
    const changeReturned = amountPaid > grandTotal ? amountPaid - grandTotal : 0;

    return {
      items: previewItems,
      subTotal,
      taxAmount,
      discountAmount,
      grandTotal,
      paymentAllocations,
      amountPaid,
      remainingAmount,
      changeReturned,
    };
  },

  /**
   * Execute POS checkout inside database session transaction
   */
  checkout: async (userId, checkoutData) => {
    return runInTransaction(async (session) => {
      const {
        items = [],
        discountAmount = 0,
        paymentAllocations = [],
        customerName = 'Walk-in Customer',
        customerPhone = '',
        notes = '',
      } = checkoutData;

      if (items.isEmpty || items.length === 0) {
        throw new AppError('Cannot check out empty billing items.', 400);
      }

      // Calculate totals
      const calculation = await billingService.preview(items, discountAmount, paymentAllocations);

      // Verify POS split constraints
      const settings = (await Settings.findOne().session(session)) || {};
      const posSettings = settings.pos || {};

      if (posSettings.allowSplitPayment === false && paymentAllocations.length > 1) {
        throw new AppError('Split payments are disabled in system settings.', 400);
      }

      if (posSettings.allowSplitPayment) {
        if (paymentAllocations.length > (posSettings.maxSplitMethods ?? 3)) {
          throw new AppError(`Maximum payment split methods exceeded. Limit is ${posSettings.maxSplitMethods}`, 400);
        }
        if (calculation.grandTotal < (posSettings.minSplitAmount ?? 0) && paymentAllocations.length > 1) {
          throw new AppError(
            `Minimum split amount is ₹${((posSettings.minSplitAmount ?? 0) / 100).toFixed(2)}`,
            400
          );
        }
      }

      // Deduct stock levels atomically
      for (const item of calculation.items) {
        const product = await Products.findOneAndUpdate(
          { _id: item.product, currentStock: { $gte: item.quantity }, isDeleted: { $ne: true } },
          { $inc: { currentStock: -item.quantity } },
          { session, new: true }
        );

        if (!product) {
          throw new AppError(`Insufficient stock or invalid product: ${item.name}`, 400);
        }

        // Sync InventoryItem levels
        await InventoryItem.findOneAndUpdate(
          { product: item.product, currentStock: { $gte: item.quantity } },
          { $inc: { currentStock: -item.quantity } },
          { session }
        );

        // Record stock movement logs
        await StockMovement.create(
          [
            {
              product: item.product,
              type: 'sale',
              quantity: item.quantity,
              notes: `POS billing checkout sale`,
            },
          ],
          { session }
        );
      }

      // Generate invoice number
      const invoiceNumber = `INV-${Date.now().toString().substring(6)}`;

      // Save billing invoice
      const invoice = await Billing.create(
        [
          {
            invoiceNumber,
            customerName,
            customerPhone,
            items: calculation.items,
            subTotal: calculation.subTotal,
            taxAmount: calculation.taxAmount,
            discountAmount: calculation.discountAmount,
            grandTotal: calculation.grandTotal,
            paymentAllocations: calculation.paymentAllocations,
            amountPaid: calculation.amountPaid,
            changeReturned: calculation.changeReturned,
            notes,
            createdBy: userId,
          },
        ],
        { session }
      );

      return invoice[0];
    });
  },
};

export default billingService;
