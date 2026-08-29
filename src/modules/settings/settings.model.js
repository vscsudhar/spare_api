import mongoose from 'mongoose';

const settingsSchema = new mongoose.Schema(
  {
    general: {
      appName: { type: String, default: 'VoltSpare' },
      logoUrl: { type: String, default: '' },
      supportEmail: { type: String, default: 'support@voltspare.com' },
      supportPhone: { type: String, default: '+919876543210' },
    },
    billing: {
      taxPercentage: { type: Number, default: 18 },
      currency: { type: String, default: 'INR' },
      invoicePrefix: { type: String, default: 'INV-' },
    },
    pos: {
      allowSplitPayment: { type: Boolean, default: true },
      minSplitAmount: { type: Number, default: 10000 }, // paise (₹100)
      maxSplitMethods: { type: Number, default: 3 },
      paymentMethods: { type: [String], default: ['cash', 'card', 'upi'] },
    },
    inventory: {
      lowStockThreshold: { type: Number, default: 10 },
      autoReorderAlert: { type: Boolean, default: true },
    },
    notifications: {
      enableEmailAlerts: { type: Boolean, default: true },
      enableSmsAlerts: { type: Boolean, default: false },
      lowStockAlertEmail: { type: String, default: 'alerts@voltspare.com' },
    },
    appearance: {
      theme: { type: String, enum: ['light', 'dark', 'system'], default: 'light' },
      primaryColor: { type: String, default: '#2196F3' },
      sidebarMode: { type: String, enum: ['expanded', 'collapsed'], default: 'expanded' },
    },
    security: {
      requireTwoFactor: { type: Boolean, default: false },
      passwordExpiryDays: { type: Number, default: 90 },
    },
  },
  {
    timestamps: true,
  }
);

export const Settings = mongoose.models.Settings || mongoose.model('Settings', settingsSchema);
export default Settings;
