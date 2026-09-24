import AppError from '../../errors/AppError.js';
import DeliveryCharge from './delivery-charges.model.js';

export const deliveryChargesService = {
  /**
   * Retrieve all delivery charge tiers with optional location filter
   * Auto-seeds default tiers if collection is empty
   */
  getAll: async (queryParams = {}) => {
    const count = await DeliveryCharge.countDocuments();
    if (count === 0) {
      await DeliveryCharge.create([
        {
          fromAmount: 0,
          toAmount: 998,
          deliveryCharge: 59,
          locationName: 'All Locations (HQ)',
          description: 'Standard delivery charge ₹59 for orders under ₹999',
          isActive: true,
        },
        {
          fromAmount: 999,
          toAmount: null,
          deliveryCharge: 0,
          locationName: 'All Locations (HQ)',
          description: 'FREE Delivery on orders ₹999 and above',
          isActive: true,
        },
      ]);
    }

    const filter = {};
    if (queryParams.isActive !== undefined) {
      filter.isActive = queryParams.isActive === 'true' || queryParams.isActive === true;
    }
    if (queryParams.locationId && queryParams.locationId !== 'all') {
      filter.$or = [
        { locationId: queryParams.locationId },
        { locationId: null },
      ];
    }

    return DeliveryCharge.find(filter).sort({ fromAmount: 1 });
  },

  /**
   * Calculate dynamic delivery fee based on order subTotal and optional locationId
   */
  calculateFee: async (subTotal = 0, locationId = null) => {
    const tiers = await deliveryChargesService.getAll({ isActive: true, locationId });
    if (!tiers || tiers.length === 0) {
      return subTotal >= 999 ? 0 : 59;
    }

    // Match tier where fromAmount <= subTotal and (toAmount is null or subTotal <= toAmount)
    const matchedTier = tiers.find((t) => {
      const from = t.fromAmount ?? 0;
      const to = t.toAmount;
      if (to === null || to === undefined) {
        return subTotal >= from;
      }
      return subTotal >= from && subTotal <= to;
    });

    if (matchedTier) {
      return matchedTier.deliveryCharge;
    }

    // Default fallback
    return subTotal >= 1000 ? 0 : 100;
  },

  /**
   * Create new delivery charge tier
   */
  create: async (data) => {
    return DeliveryCharge.create(data);
  },

  /**
   * Update delivery charge tier
   */
  update: async (id, data) => {
    const tier = await DeliveryCharge.findByIdAndUpdate(id, data, { new: true, runValidators: true });
    if (!tier) {
      throw new AppError('Delivery charge tier not found', 404);
    }
    return tier;
  },

  /**
   * Delete delivery charge tier
   */
  delete: async (id) => {
    const tier = await DeliveryCharge.findByIdAndDelete(id);
    if (!tier) {
      throw new AppError('Delivery charge tier not found', 404);
    }
    return tier;
  },
};

export default deliveryChargesService;
