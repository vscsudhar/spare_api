import Settings from './settings.model.js';
import Invoice from '../invoices/invoices.model.js';
import { getStateCode } from '../invoices/invoices.helper.js';
import { uploadFile } from '../../utils/storage.js';
import AppError from '../../errors/AppError.js';

export const settingsService = {
  /**
   * Fetch current global settings document.
   * Creates one with defaults if it does not exist.
   */
  getSettings: async () => {
    let doc = await Settings.findOne();
    if (!doc) {
      doc = await Settings.create({});
    }
    return doc;
  },

  /**
   * Update settings sub-section
   * @param {string} section - general, billing, pos, inventory, notifications, appearance, security
   * @param {object} data - section updates
   */
  updateSection: async (section, data) => {
    let settings = await Settings.findOne();
    if (!settings) {
      settings = await Settings.create({});
    }

    if (!settings[section]) {
      settings[section] = {};
    }

    // Apply updates on subdocument
    Object.keys(data).forEach((key) => {
      settings[section][key] = data[key];
    });

    // POS split payment validation checks
    if (section === 'pos') {
      const pos = settings.pos;
      if (pos.allowSplitPayment) {
        if (pos.maxSplitMethods < 1) {
          throw new AppError('Max split methods must be at least 1', 400);
        }
        if (pos.paymentMethods.length < 1) {
          throw new AppError('Payment methods cannot be empty when split payment is enabled', 400);
        }
      }
    }

    const saved = await settings.save();

    // Synchronize latest business info to all existing invoices
    if (section === 'general') {
      const g = saved.general || {};
      const businessState = g.state || 'Karnataka';
      const businessStateCode = g.stateCode || getStateCode(businessState);

      await Invoice.updateMany(
        {},
        {
          $set: {
            'business.name': g.appName || 'VoltSpare Automotive',
            'business.legalName': g.legalName || g.appName || 'VoltSpare Automotive Technologies Pvt. Ltd.',
            'business.addressLine1': g.addressLine1 || g.address || '12, MG Road, Landmark Block',
            'business.addressLine2': g.addressLine2 || '',
            'business.city': g.city || 'Bangalore',
            'business.state': businessState,
            'business.stateCode': businessStateCode,
            'business.postalCode': g.postalCode || g.pincode || '560001',
            'business.phone': g.supportPhone || '+91 99000 88000',
            'business.email': g.supportEmail || 'billing@voltspare.com',
            'business.gstin': g.gstin || g.gstNumber || '29AAAAA0000A1Z1',
            'business.pan': g.pan || 'AAAAA0000A',
            'business.website': g.website || 'www.voltspare.com',
          },
        }
      ).catch(() => {});
    }

    return saved;
  },

  /**
   * Upload logo and update general settings logo url
   * @param {object} file - Express multer file
   */
  uploadLogo: async (file) => {
    if (!file) {
      throw new AppError('Logo file is required.', 400);
    }

    const uploadResult = await uploadFile(file);
    let settings = await Settings.findOne();
    if (!settings) {
      settings = await Settings.create({});
    }

    settings.general.logoUrl = uploadResult.url;
    await settings.save();

    return settings;
  },
};

export default settingsService;
