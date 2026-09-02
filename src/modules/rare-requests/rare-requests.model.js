import mongoose from 'mongoose';

// 1. RareRequestImage Subdocument Schema
const rareRequestImageSchema = new mongoose.Schema({
  url: {
    type: String,
    required: true,
  },
  publicId: {
    type: String,
    default: null,
  },
  uploadedAt: {
    type: Date,
    default: Date.now,
  },
});

// 2. RareRequestCancellation Subdocument Schema
const rareRequestCancellationSchema = new mongoose.Schema({
  reason: {
    type: String,
    required: true,
  },
  cancelledBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Users',
    required: true,
  },
  cancelledAt: {
    type: Date,
    default: Date.now,
  },
});

// 3. RareProductRequest Main Schema
const rareProductRequestSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Users',
      required: true,
    },
    title: {
      type: String,
      required: [true, 'Product title is required'],
      trim: true,
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
    },
    vehicleType: {
      type: String,
      required: [true, 'Vehicle type (EV, Petrol, Universal) is required'],
      enum: ['EV', 'Petrol', 'Universal'],
    },
    vehicleBrand: {
      type: String,
      required: [true, 'Vehicle brand is required'],
      trim: true,
    },
    vehicleModel: {
      type: String,
      required: [true, 'Vehicle model is required'],
      trim: true,
    },
    vehicleYear: {
      type: Number,
      required: [true, 'Vehicle year is required'],
    },
    partNumber: {
      type: String,
      trim: true,
      default: '',
    },
    status: {
      type: String,
      enum: [
        'submitted',
        'searching',
        'found',
        'quotation_sent',
        'negotiation',
        'approved',
        'cancelled',
        'converted_to_order',
      ],
      default: 'submitted',
      required: true,
    },
    images: [rareRequestImageSchema],
    cancellation: {
      type: rareRequestCancellationSchema,
      default: null,
    },
    convertedOrder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
rareProductRequestSchema.index({ user: 1 });
rareProductRequestSchema.index({ status: 1 });

// 4. RareQuotationItem Subdocument Schema
const rareQuotationItemSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  partNumber: {
    type: String,
    trim: true,
    default: '',
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
  },
  unitPrice: {
    type: Number, // Stored in paise
    required: true,
    min: 0,
  },
  taxPercentage: {
    type: Number,
    default: 18,
  },
  totalPrice: {
    type: Number, // Stored in paise
    required: true,
    min: 0,
  },
});

// 5. RareQuotation Schema
const rareQuotationSchema = new mongoose.Schema(
  {
    request: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RareProductRequest',
      required: true,
    },
    quotationNumber: {
      type: String,
      required: true,
      uppercase: true,
    },
    items: [rareQuotationItemSchema],
    subTotal: {
      type: Number, // Stored in paise
      required: true,
      min: 0,
    },
    taxAmount: {
      type: Number, // Stored in paise
      required: true,
      min: 0,
    },
    deliveryFee: {
      type: Number, // Stored in paise
      required: true,
      min: 0,
    },
    discount: {
      type: Number,
      default: 0,
    },
    deliveryTimeline: {
      type: String,
      default: '3 - 5 Days Delivery',
    },
    adminNotes: {
      type: String,
      default: '',
    },
    grandTotal: {
      type: Number, // Stored in paise
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: ['draft', 'sent', 'approved', 'cancelled', 'expired'],
      default: 'draft',
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    revisedFrom: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RareQuotation',
      default: null,
    },
    revisionNumber: {
      type: Number,
      default: 0,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Users',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

rareQuotationSchema.index({ request: 1 });
rareQuotationSchema.index({ quotationNumber: 1, revisionNumber: 1 }, { unique: true });

// 6. RareChatMessage Schema
const rareChatMessageSchema = new mongoose.Schema(
  {
    request: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RareProductRequest',
      required: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Users',
      required: true,
    },
    senderType: {
      type: String,
      enum: ['customer', 'admin', 'system'],
      required: true,
    },
    messageType: {
      type: String,
      enum: ['text', 'image', 'quotation', 'status_update', 'product_found', 'system'],
      required: true,
    },
    message: {
      type: String,
      trim: true,
      default: '',
    },
    imageUrl: {
      type: String,
      default: '',
    },
    quotation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RareQuotation',
      default: null,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    readBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Users',
      },
    ],
    receivedBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Users',
      },
    ],
  },
  {
    timestamps: true,
  }
);

rareChatMessageSchema.index({ request: 1, createdAt: 1 });

// 7. RareRequestActivity Schema
const rareRequestActivitySchema = new mongoose.Schema(
  {
    request: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RareProductRequest',
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Users',
      default: null,
    },
    type: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

rareRequestActivitySchema.index({ request: 1 });

// Model Compilation
export const RareProductRequest =
  mongoose.models.RareProductRequest ||
  mongoose.model('RareProductRequest', rareProductRequestSchema);

export const RareQuotation =
  mongoose.models.RareQuotation || mongoose.model('RareQuotation', rareQuotationSchema);

export const RareChatMessage =
  mongoose.models.RareChatMessage || mongoose.model('RareChatMessage', rareChatMessageSchema);

export const RareRequestActivity =
  mongoose.models.RareRequestActivity ||
  mongoose.model('RareRequestActivity', rareRequestActivitySchema);

// Default Export is the request model
export default RareProductRequest;
