import AppError from '../../errors/AppError.js';
import Addresses from './addresses.model.js';

export const addressesService = {
  /**
   * Get all addresses for a specific user
   */
  getAllForUser: async (userId) => {
    return Addresses.find({ user: userId });
  },

  /**
   * Create new address for user
   */
  create: async (userId, data) => {
    const existingCount = await Addresses.countDocuments({ user: userId });

    let isDefault = data.isDefault || false;
    // Auto-make default if it's the first address
    if (existingCount === 0) {
      isDefault = true;
    }

    if (isDefault) {
      // Unset previous defaults
      await Addresses.updateMany({ user: userId }, { isDefault: false });
    }

    return Addresses.create({
      ...data,
      user: userId,
      isDefault,
    });
  },

  /**
   * Update address
   */
  update: async (userId, addressId, data) => {
    const address = await Addresses.findOne({ _id: addressId, user: userId });
    if (!address) {
      throw new AppError('Address not found.', 404);
    }

    if (data.isDefault) {
      // Unset previous defaults
      await Addresses.updateMany({ user: userId, _id: { $ne: addressId } }, { isDefault: false });
      address.isDefault = true;
    } else if (data.isDefault === false && address.isDefault) {
      // Cannot manually unset default if it's the only one.
      // Or we let them unset, but let's check count first.
      const otherAddress = await Addresses.findOne({ user: userId, _id: { $ne: addressId } });
      if (otherAddress) {
        otherAddress.isDefault = true;
        await otherAddress.save();
        address.isDefault = false;
      } else {
        // Only one address left, keep default
        address.isDefault = true;
      }
    }

    const fields = [
      'name',
      'recipientName',
      'phone',
      'addressLine1',
      'addressLine2',
      'city',
      'state',
      'postalCode',
      'country',
    ];

    fields.forEach((field) => {
      if (data[field] !== undefined) {
        address[field] = data[field];
      }
    });

    return address.save();
  },

  /**
   * Delete address
   */
  delete: async (userId, addressId) => {
    const address = await Addresses.findOne({ _id: addressId, user: userId });
    if (!address) {
      throw new AppError('Address not found.', 404);
    }

    const wasDefault = address.isDefault;
    await Addresses.deleteOne({ _id: addressId, user: userId });

    // If we deleted the default address, make the next available address default
    if (wasDefault) {
      const nextAddress = await Addresses.findOne({ user: userId });
      if (nextAddress) {
        nextAddress.isDefault = true;
        await nextAddress.save();
      }
    }
  },

  /**
   * Set address as default
   */
  setDefault: async (userId, addressId) => {
    const address = await Addresses.findOne({ _id: addressId, user: userId });
    if (!address) {
      throw new AppError('Address not found.', 404);
    }

    await Addresses.updateMany({ user: userId }, { isDefault: false });
    address.isDefault = true;
    return address.save();
  },
};

export default addressesService;
