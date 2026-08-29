import mongoose from 'mongoose';

const supplierContactSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Contact name is required'],
    trim: true,
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
  },
  phone: {
    type: String,
    trim: true,
  },
  designation: {
    type: String,
    trim: true,
  },
});

const supplierSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Supplier name is required'],
      unique: true,
      trim: true,
    },
    code: {
      type: String,
      required: [true, 'Supplier code is required'],
      unique: true,
      trim: true,
      uppercase: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    gstNumber: {
      type: String,
      trim: true,
    },
    address: {
      type: String,
      trim: true,
    },
    city: {
      type: String,
      trim: true,
    },
    state: {
      type: String,
      trim: true,
    },
    bankDetails: {
      bankName: { type: String, trim: true },
      accountNumber: { type: String, trim: true },
      ifscCode: { type: String, trim: true },
      accountName: { type: String, trim: true },
    },
    upiId: {
      type: String,
      trim: true,
    },
    creditLimit: {
      type: Number,
      default: 0,
      min: 0,
    },
    paymentTerms: {
      type: String, // e.g. 'Net 30', 'Net 60', 'COD'
      trim: true,
      default: 'COD',
    },
    vehicleCategories: [
      {
        type: String,
        enum: ['EV', 'Petrol', 'Universal'],
        default: 'Universal',
      },
    ],
    outstandingBalance: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },
    contacts: [supplierContactSchema],
  },
  { timestamps: true }
);

const supplierProductSchema = new mongoose.Schema(
  {
    supplier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Supplier',
      required: true,
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Products',
      required: true,
    },
    supplierSku: {
      type: String,
      trim: true,
    },
    lastPurchasePrice: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true }
);

supplierProductSchema.index({ supplier: 1, product: 1 }, { unique: true });

const supplierPaymentSchema = new mongoose.Schema(
  {
    supplier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Supplier',
      required: true,
    },
    amount: {
      type: Number,
      required: [true, 'Payment amount is required'],
      min: [0.01, 'Amount must be greater than zero'],
    },
    paymentDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    paymentMethod: {
      type: String,
      enum: ['bank_transfer', 'upi', 'cash', 'cheque'],
      required: true,
    },
    transactionReference: {
      type: String,
      trim: true,
    },
    notes: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

export const Supplier = mongoose.models.Supplier || mongoose.model('Supplier', supplierSchema);
export const SupplierProduct =
  mongoose.models.SupplierProduct || mongoose.model('SupplierProduct', supplierProductSchema);
export const SupplierPayment =
  mongoose.models.SupplierPayment || mongoose.model('SupplierPayment', supplierPaymentSchema);

export default Supplier;
