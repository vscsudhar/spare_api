import mongoose from 'mongoose';

const productCompatibilitySchema = new mongoose.Schema({
  brand: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'VehicleBrand',
    required: true,
  },
  model: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'VehicleModel',
    required: true,
  },
  years: [
    {
      type: String,
      trim: true,
    },
  ],
});

const productImageSchema = new mongoose.Schema({
  url: {
    type: String,
    required: true,
  },
  isDefault: {
    type: Boolean,
    default: false,
  },
});

const productVariantSchema = new mongoose.Schema({
  sku: {
    type: String,
    required: true,
    trim: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  price: {
    type: Number,
    required: true,
    min: 0,
  },
  stock: {
    type: Number,
    default: 0,
    min: 0,
  },
});

const productsSchema = new mongoose.Schema(
  {
    sku: {
      type: String,
      required: [true, 'SKU is required'],
      unique: true,
      trim: true,
    },
    name: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true,
    },
    slug: {
      type: String,
      required: [true, 'Slug is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    brand: {
      type: String,
      trim: true,
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Categories',
      required: [true, 'Category is required'],
    },
    vehicleType: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'VehicleType',
    },
    compatibilities: [productCompatibilitySchema],
    oemPartNumbers: [
      {
        type: String,
        trim: true,
      },
    ],
    sellingPrice: {
      type: Number,
      required: [true, 'Selling price is required'],
      min: 0,
    },
    mrp: {
      type: Number,
      required: [true, 'MRP is required'],
      min: 0,
    },
    purchasePrice: {
      type: Number,
      required: [true, 'Purchase price is required'],
      min: 0,
    },
    taxPercentage: {
      type: Number,
      default: 18,
      min: 0,
      max: 100,
    },
    unit: {
      type: String,
      default: 'pcs',
      trim: true,
    },
    images: [productImageSchema],
    variants: [productVariantSchema],
    featured: {
      type: Boolean,
      default: false,
    },
    fastMoving: {
      type: Boolean,
      default: false,
    },
    active: {
      type: Boolean,
      default: true,
    },
    searchKeywords: [
      {
        type: String,
        trim: true,
      },
    ],
    currentStock: {
      type: Number,
      default: 0,
      min: 0,
    },
    reservedStock: {
      type: Number,
      default: 0,
      min: 0,
    },
    minimumStock: {
      type: Number,
      default: 0,
      min: 0,
    },
    locationBin: {
      type: String,
      trim: true,
    },
    warranty: {
      type: String,
      trim: true,
    },
    returnEligibility: {
      type: Boolean,
      default: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      select: false,
    },
    deletedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for searching/filtering
productsSchema.index({ name: 'text', description: 'text', searchKeywords: 'text' });
productsSchema.index({ category: 1 });
productsSchema.index({ active: 1 });

// Exclude soft-deleted products by default
productsSchema.pre(/^find/, function (next) {
  if (this.getFilter().includeDeleted) {
    delete this.getFilter().includeDeleted;
    return next();
  }
  this.find({ isDeleted: { $ne: true } });
  next();
});

export const Products = mongoose.models.Products || mongoose.model('Products', productsSchema);
export default Products;
