import Wishlist from '../wishlist/wishlist.model.js';
﻿import AppError from '../../errors/AppError.js';
import Products from './products.model.js';
import Categories from '../categories/categories.model.js';
import { VehicleBrand, VehicleModel, VehicleType } from './catalog.model.js';

const slugify = (text) =>
  text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-');

export const productsService = {
  /**
   * Get all products with pagination, search, sorting, and filters
   */
  getAll: async (queryParams = {}, userId = null) => {
    const page = parseInt(queryParams.page, 10) || 1;
    const limit = parseInt(queryParams.limit, 10) || 10;
    const skip = (page - 1) * limit;

    const queryObj = {};

    // 1. Text Search / Keywords
    if (queryParams.search) {
      queryObj.$text = { $search: queryParams.search };
    }

    // 2. Featured Filter
    if (queryParams.featured !== undefined) {
      queryObj.featured = queryParams.featured === 'true' || queryParams.featured === true;
    }

    // 3. Active Status Filter
    if (queryParams.active !== undefined) {
      queryObj.active = queryParams.active === 'true' || queryParams.active === true;
    }

    // 4. Category Filter
    if (queryParams.category) {
      queryObj.category = queryParams.category;
    }

    // 5. Brand (Manufacturer) Filter
    if (queryParams.brand) {
      queryObj.brand = queryParams.brand;
    }

    // 6. Price Range Filters
    if (queryParams.minPrice || queryParams.maxPrice) {
      queryObj.sellingPrice = {};
      if (queryParams.minPrice) {
        queryObj.sellingPrice.$gte = parseFloat(queryParams.minPrice);
      }
      if (queryParams.maxPrice) {
        queryObj.sellingPrice.$lte = parseFloat(queryParams.maxPrice);
      }
    }

    // 7. Stock Status Filters
    if (queryParams.stockStatus) {
      if (queryParams.stockStatus === 'in-stock') {
        queryObj.currentStock = { $gt: 0 };
      } else if (queryParams.stockStatus === 'out-of-stock') {
        queryObj.currentStock = 0;
      } else if (queryParams.stockStatus === 'low-stock') {
        queryObj.$expr = { $lte: ['$currentStock', '$minimumStock'] };
      }
    }

    // 8. EV/Petrol/Universal Filter
    if (queryParams.type) {
      // Find Category IDs matching this type
      const targetCategories = await Categories.find({
        type: { $in: [queryParams.type, 'Universal'] },
      }).select('_id');
      const categoryIds = targetCategories.map((c) => c._id);

      // Find Vehicle Model IDs matching this type
      const targetModels = await VehicleModel.find({
        type: { $in: [queryParams.type, 'Universal'] },
      }).select('_id');
      const modelIds = targetModels.map((m) => m._id);

      queryObj.$or = [
        { category: { $in: categoryIds } },
        { 'compatibilities.model': { $in: modelIds } },
      ];
    }

    // 9. Specific Vehicle Model compatibility filter
    if (queryParams.vehicleModel) {
      queryObj['compatibilities.model'] = queryParams.vehicleModel;
    }

    // Build Query
    let dbQuery = Products.find(queryObj);

    // 10. Sorting
    if (queryParams.sortBy) {
      const parts = queryParams.sortBy.split(':');
      const sortField = parts[0];
      const sortOrder = parts[1] === 'desc' ? -1 : 1;
      dbQuery = dbQuery.sort({ [sortField]: sortOrder });
    } else {
      dbQuery = dbQuery.sort({ createdAt: -1 }); // default sorting
    }

    // Execute Query
    const products = await dbQuery
      .skip(skip)
      .limit(limit)
      .populate('category')
      .populate('vehicleType')
      .populate('compatibilities.brand')
      .populate('compatibilities.model');

    const total = await Products.countDocuments(queryObj);

    let formattedProducts = products;
    if (userId) {
      const wishlist = await Wishlist.findOne({ user: userId });
      const wishlistedSet = new Set((wishlist?.products || []).map((id) => id.toString()));
      formattedProducts = products.map((p) => {
        const obj = p.toObject ? p.toObject() : { ...p };
        return {
          ...obj,
          isWishlist: wishlistedSet.has(p._id.toString()),
        };
      });
    } else {
      formattedProducts = products.map((p) => {
        const obj = p.toObject ? p.toObject() : { ...p };
        return {
          ...obj,
          isWishlist: false,
        };
      });
    }

    return {
      products: formattedProducts,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  },

  /**
   * Get Product by ID
   */
  getById: async (id, userId = null) => {
    const product = await Products.findById(id)
      .populate('category')
      .populate('vehicleType')
      .populate('compatibilities.brand')
      .populate('compatibilities.model');

    if (!product) {
      throw new AppError('Product not found.', 404);
    }
    let isWishlist = false;
    if (userId) {
      const wishlist = await Wishlist.findOne({ user: userId });
      isWishlist = (wishlist?.products || []).some((pId) => pId.toString() === product._id.toString());
    }
    const productObj = product.toObject ? product.toObject() : { ...product };
    productObj.compatibleVehicles = productObj.compatibilities || [];
    return {
      ...productObj,
      isWishlist,
    };
  },

  /**
   * Create Product
   */
  create: async (data) => {
    const slug = slugify(data.name);


    // Normalize compatibleVehicles to compatibilities
    if (data.compatibleVehicles !== undefined && (!data.compatibilities || data.compatibilities.length === 0)) {
      data.compatibilities = data.compatibleVehicles;
    }

    if (data.fitType === 'universal') {
      data.compatibilities = [];
    } else if (data.compatibilities && data.compatibilities.length > 0) {
      for (const comp of data.compatibilities) {
        if (!comp.brand || !comp.model) {
          throw new AppError('Brand and Model are required for each compatible vehicle.', 400);
        }
        const modelDoc = await VehicleModel.findById(comp.model);
        if (!modelDoc) {
          throw new AppError(`Vehicle model with ID ${comp.model} not found.`, 400);
        }
        if (modelDoc.brand.toString() !== comp.brand.toString()) {
          throw new AppError(`Vehicle model '${modelDoc.name}' does not belong to the selected brand.`, 400);
        }
      }
    }

    // Ensure unique SKU & Slug
    const skuExists = await Products.findOne({ sku: data.sku, includeDeleted: true });
    if (skuExists) {
      throw new AppError(`Product with SKU: ${data.sku} already exists.`, 400);
    }

    const slugExists = await Products.findOne({ slug, includeDeleted: true });
    if (slugExists) {
      throw new AppError(`Product with name (slug): ${data.name} already exists.`, 400);
    }

    // Ensure category exists
    const category = await Categories.findById(data.category);
    if (!category) {
      throw new AppError('Category not found.', 404);
    }

    return Products.create({
      ...data,
      slug,
    });
  },

  /**
   * Update Product
   */
  update: async (id, data) => {
    const product = await Products.findById(id);
    if (!product) {
      throw new AppError('Product not found.', 404);
    }

    if (data.sku && data.sku !== product.sku) {
      const skuExists = await Products.findOne({
        _id: { $ne: id },
        sku: data.sku,
        includeDeleted: true,
      });
      if (skuExists) {
        throw new AppError(`Product with SKU: ${data.sku} already exists.`, 400);
      }
      product.sku = data.sku;
    }

    if (data.name && data.name !== product.name) {
      const slug = slugify(data.name);
      const slugExists = await Products.findOne({
        _id: { $ne: id },
        slug,
        includeDeleted: true,
      });
      if (slugExists) {
        throw new AppError(`Product with name (slug): ${data.name} already exists.`, 400);
      }
      product.name = data.name;
      product.slug = slug;
    }

    if (data.category && data.category !== product.category.toString()) {
      const category = await Categories.findById(data.category);
      if (!category) {
        throw new AppError('Category not found.', 404);
      }
      product.category = data.category;
    }


    // Normalize compatibleVehicles to compatibilities
    if (data.compatibleVehicles !== undefined && (!data.compatibilities || data.compatibilities.length === 0)) {
      data.compatibilities = data.compatibleVehicles;
    }

    if (data.fitType === 'universal') {
      data.compatibilities = [];
    } else if (data.compatibilities && data.compatibilities.length > 0) {
      for (const comp of data.compatibilities) {
        if (!comp.brand || !comp.model) {
          throw new AppError('Brand and Model are required for each compatible vehicle.', 400);
        }
        const modelDoc = await VehicleModel.findById(comp.model);
        if (!modelDoc) {
          throw new AppError(`Vehicle model with ID ${comp.model} not found.`, 400);
        }
        if (modelDoc.brand.toString() !== comp.brand.toString()) {
          throw new AppError(`Vehicle model '${modelDoc.name}' does not belong to the selected brand.`, 400);
        }
      }
    }


    // Set other fields directly
    const directFields = [
      'description',
      'fitType',
      'stockManaged',
      'brand',
      'vehicleType',
      'compatibilities',
      'oemPartNumbers',
      'sellingPrice',
      'mrp',
      'purchasePrice',
      'taxPercentage',
      'currentStock',
      'unit',
      'variants',
      'featured',
      'fastMoving',
      'active',
      'searchKeywords',
      'minimumStock',
      'locationBin',
      'warranty',
      'returnEligibility',
      'images',
    ];

    directFields.forEach((field) => {
      if (data[field] !== undefined) {
        product[field] = data[field];
      }
    });

    await product.save();

    return productsService.getById(id);
  },

  /**
   * Soft Delete Product
   */
  delete: async (id) => {
    const product = await Products.findById(id);
    if (!product) {
      throw new AppError('Product not found.', 404);
    }
    product.isDeleted = true;
    product.deletedAt = new Date();
    await product.save();
  },

  /**
   * Toggle Active Status
   */
  updateStatus: async (id, active) => {
    const product = await Products.findById(id);
    if (!product) {
      throw new AppError('Product not found.', 404);
    }
    product.active = active;
    await product.save();
    return product;
  },

  /**
   * Add image to product
   */
  addImage: async (id, url, isDefault = false) => {
    const product = await Products.findById(id);
    if (!product) {
      throw new AppError('Product not found.', 404);
    }

    // If setting to default, clear other default images
    if (isDefault) {
      product.images.forEach((img) => {
        img.isDefault = false;
      });
    }

    product.images.push({ url, isDefault });
    await product.save();
    return product;
  },

  /**
   * Remove image from product
   */
  deleteImage: async (id, imageId) => {
    const product = await Products.findById(id);
    if (!product) {
      throw new AppError('Product not found.', 404);
    }

    const imageIndex = product.images.findIndex((img) => img._id.toString() === imageId);
    if (imageIndex === -1) {
      throw new AppError('Image not found in product gallery.', 404);
    }

    product.images.splice(imageIndex, 1);
    await product.save();
    return product;
  },

  /**
   * Retrieve vehicle brands list
   */
  getVehicleBrands: async () => {
    return VehicleBrand.find().populate('vehicleType');
  },

  createVehicleBrand: async (name, vehicleTypeName) => {
    let typeDoc;
    if (vehicleTypeName) {
      typeDoc = await VehicleType.findOne({ name: vehicleTypeName });
    }
    if (!typeDoc) {
      typeDoc = await VehicleType.findOne();
    }
    if (!typeDoc) {
      typeDoc = await VehicleType.create({ name: 'Scooter', slug: 'scooter' });
    }
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    
    // Check if brand already exists to prevent duplicate error
    let brand = await VehicleBrand.findOne({ slug });
    if (brand) return brand;

    return VehicleBrand.create({
      name,
      slug,
      vehicleType: typeDoc._id
    });
  },

  updateVehicleBrand: async (id, name) => {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    return VehicleBrand.findByIdAndUpdate(id, { name, slug }, { new: true });
  },

  /**
   * Retrieve vehicle models list
   */
  getVehicleModels: async (filter = {}) => {
    return VehicleModel.find(filter).populate('brand');
  },

  createVehicleModel: async (name, brandId, type, years) => {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    
    // Check if model already exists for this brand
    let model = await VehicleModel.findOne({ slug, brand: brandId });
    if (model) return model;

    return VehicleModel.create({
      name,
      slug,
      brand: brandId,
      type: type || 'Universal',
      years: years || []
    });
  },

  updateVehicleModel: async (id, name, brandId, type, years) => {
    const updateData = {};
    if (name) {
      updateData.name = name;
      updateData.slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    }
    if (brandId) updateData.brand = brandId;
    if (type) updateData.type = type;
    if (years) updateData.years = years;
    return VehicleModel.findByIdAndUpdate(id, updateData, { new: true });
  },
};

export default productsService;

