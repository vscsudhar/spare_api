import AppError from '../../errors/AppError.js';
import Products from '../products/products.model.js';
import { InventoryItem, StockMovement, StockAdjustment } from './inventory.model.js';

export const inventoryService = {
  /**
   * Centralized method to update stock and log movements.
   * Every stock change MUST call this method to remain auditable.
   */
  updateStock: async (
    productId,
    type,
    quantity,
    referenceType,
    referenceId,
    userId,
    notes = '',
    session = null
  ) => {
    // 1. Ensure Product exists
    const product = await Products.findById(productId).session(session);
    if (!product) {
      throw new AppError('Product not found.', 404);
    }

    // 2. Find or Create InventoryItem
    let invItem = await InventoryItem.findOne({ product: productId }).session(session);
    if (!invItem) {
      invItem = new InventoryItem({
        product: productId,
        currentStock: 0,
        reservedStock: 0,
        minimumStock: product.minimumStock || 0,
        locationBin: product.locationBin || '',
      });
    }

    // 3. Calculate new stock level
    const newStock = invItem.currentStock + quantity;
    if (newStock < 0) {
      throw new AppError(
        `Insufficient stock for product ${product.name}. Current stock: ${invItem.currentStock}, requested change: ${quantity}`,
        400
      );
    }

    // Update stock levels
    invItem.currentStock = newStock;
    await invItem.save({ session });

    // Sync Product model's stock field
    product.currentStock = newStock;
    await product.save({ session });

    // 4. Create StockMovement Audit Log
    await StockMovement.create(
      [
        {
          product: productId,
          type,
          quantity,
          referenceType,
          referenceId,
          user: userId,
          notes,
        },
      ],
      { session }
    );

    return invItem;
  },

  /**
   * Get all inventory items
   */
  getAll: async () => {
    return InventoryItem.find().populate({
      path: 'product',
      populate: {
        path: 'category',
        model: 'Categories',
      },
    });
  },

  /**
   * Get inventory summary (total stock count, value, low stock warnings)
   */
  getSummary: async () => {
    const items = await InventoryItem.find().populate('product');

    let totalItems = items.length;
    let totalStock = 0;
    let totalValue = 0;
    let lowStockAlerts = 0;

    items.forEach((item) => {
      totalStock += item.currentStock;
      if (item.currentStock <= item.minimumStock) {
        lowStockAlerts += 1;
      }
      if (item.product) {
        // Calculate inventory valuation based on purchasePrice
        totalValue += item.currentStock * (item.product.purchasePrice || 0);
      }
    });

    return {
      totalItems,
      totalStock,
      totalValue,
      lowStockAlerts,
    };
  },

  /**
   * Get low stock inventory items
   */
  getLowStock: async () => {
    // currentStock <= minimumStock
    return InventoryItem.find({
      $expr: { $lte: ['$currentStock', '$minimumStock'] },
    }).populate('product');
  },

  /**
   * Get out of stock inventory items
   */
  getOutOfStock: async () => {
    return InventoryItem.find({ currentStock: 0 }).populate('product');
  },

  /**
   * Get movements history for a specific product
   */
  getMovements: async (productId) => {
    return StockMovement.find({ product: productId })
      .sort({ createdAt: -1 })
      .populate('user')
      .populate('product');
  },

  /**
   * Record manual stock adjustment
   */
  createAdjustment: async (productId, quantity, reason, userId) => {
    // Verify product exists
    const product = await Products.findById(productId);
    if (!product) {
      throw new AppError('Product not found.', 404);
    }

    // 1. Create adjustment audit log
    const adjustment = await StockAdjustment.create({
      product: productId,
      quantity,
      reason,
      user: userId,
    });

    // 2. Perform the actual stock update & movement log
    await inventoryService.updateStock(
      productId,
      'adjustment',
      quantity,
      'StockAdjustment',
      adjustment._id,
      userId,
      reason
    );

    return adjustment;
  },
};

export default inventoryService;
