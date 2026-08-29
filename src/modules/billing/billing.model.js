import mongoose from 'mongoose';

const billingSchema = new mongoose.Schema(
  {
    invoiceNumber: {
      type: String,
      required: true,
      unique: true,
    },
    customerName: {
      type: String,
      default: 'Walk-in Customer',
    },
    customerPhone: {
      type: String,
      default: '',
    },
    items: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Product',
          required: true,
        },
        name: {
          type: String,
          required: true,
        },
        quantity: {
          type: Number,
          required: true,
          min: 1,
        },
        unitPrice: {
          type: Number,
          required: true, // in paise
        },
        totalPrice: {
          type: Number,
          required: true, // in paise
        },
      },
    ],
    subTotal: {
      type: Number,
      required: true, // in paise
    },
    taxAmount: {
      type: Number,
      required: true, // in paise
    },
    discountAmount: {
      type: Number,
      default: 0, // in paise
    },
    grandTotal: {
      type: Number,
      required: true, // in paise
    },
    paymentAllocations: [
      {
        method: {
          type: String,
          required: true, // e.g. 'cash', 'card', 'upi'
        },
        amount: {
          type: Number,
          required: true, // in paise
        },
      },
    ],
    amountPaid: {
      type: Number,
      required: true, // in paise
    },
    changeReturned: {
      type: Number,
      default: 0, // in paise
    },
    notes: {
      type: String,
      default: '',
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

export const Billing = mongoose.models.Billing || mongoose.model('Billing', billingSchema);
export default Billing;
