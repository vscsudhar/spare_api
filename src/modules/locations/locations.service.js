import AppError from '../../errors/AppError.js';
import Location from './locations.model.js';
import LocationInventory from './location-inventory.model.js';
import Products from '../products/products.model.js';

export const locationsService = {
  /**
   * Get all locations with optional search and status filter
   */
  getAll: async (query = {}) => {
    const filter = {};

    if (query.search) {
      filter.name = { $regex: query.search, $options: 'i' };
    }

    if (query.status) {
      if (query.status.toLowerCase() === 'active') {
        filter.isActive = true;
      } else if (query.status.toLowerCase() === 'inactive') {
        filter.isActive = false;
      }
    }

    return Location.find(filter).sort({ createdAt: -1 });
  },

  /**
   * Get a single location by ID
   */
  getById: async (id) => {
    const location = await Location.findById(id);
    if (!location) {
      throw new AppError('Location not found.', 404);
    }
    return location;
  },

  /**
   * Create a new location
   */
  create: async (data) => {
    const existing = await Location.findOne({
      name: { $regex: new RegExp(`^${data.name.trim()}$`, 'i') },
    });
    if (existing) {
      throw new AppError('A location with this name already exists.', 400);
    }

    const locationDoc = {
      name: data.name.trim(),
      location: {
        type: 'Point',
        coordinates: [data.longitude, data.latitude],
      },
      radiusKm: data.radiusKm ?? 20,
      isActive: data.isActive !== undefined ? data.isActive : true,
    };

    return Location.create(locationDoc);
  },

  /**
   * Update an existing location
   */
  update: async (id, data) => {
    const location = await Location.findById(id);
    if (!location) {
      throw new AppError('Location not found.', 404);
    }

    if (data.name && data.name.trim().toLowerCase() !== location.name.toLowerCase()) {
      const existing = await Location.findOne({
        _id: { $ne: id },
        name: { $regex: new RegExp(`^${data.name.trim()}$`, 'i') },
      });
      if (existing) {
        throw new AppError('Another location with this name already exists.', 400);
      }
      location.name = data.name.trim();
    }

    if (data.latitude !== undefined || data.longitude !== undefined) {
      const currentCoords = location.location?.coordinates || [0, 0];
      const newLng = data.longitude !== undefined ? data.longitude : currentCoords[0];
      const newLat = data.latitude !== undefined ? data.latitude : currentCoords[1];

      location.location = {
        type: 'Point',
        coordinates: [newLng, newLat],
      };
    }

    if (data.radiusKm !== undefined) {
      location.radiusKm = data.radiusKm;
    }

    if (data.isActive !== undefined) {
      location.isActive = data.isActive;
    }

    await location.save();
    return location;
  },

  /**
   * Delete a location and its associated inventory records
   */
  delete: async (id) => {
    const location = await Location.findById(id);
    if (!location) {
      throw new AppError('Location not found.', 404);
    }

    await Location.findByIdAndDelete(id);
    await LocationInventory.deleteMany({ locationId: id });
    return true;
  },

  // -------------------------------------------------------------
  // Location-wise Inventory Subsystem
  // -------------------------------------------------------------

  /**
   * Get location inventory with populated products and search support
   */
  getLocationInventory: async (locationId, query = {}) => {
    const location = await Location.findById(locationId);
    if (!location) {
      throw new AppError('Location not found.', 404);
    }

    const inventoryRecords = await LocationInventory.find({ locationId }).sort({ updatedAt: -1 });

    const productIds = inventoryRecords.map((inv) => inv.productId);
    const productsList = await Products.find({
      _id: { $in: productIds },
    });

    const productMap = {};
    productsList.forEach((p) => {
      productMap[p._id.toString()] = p;
    });

    let items = [];
    for (const inv of inventoryRecords) {
      const p = productMap[inv.productId.toString()];
      if (!p || p.isDeleted) continue;

      const imageUrl =
        Array.isArray(p.images) && p.images.length > 0 ? (p.images[0].url || p.images[0]) : '';
      const price = p.priceInPaise ? p.priceInPaise / 100.0 : (p.sellingPrice ? p.sellingPrice / 100.0 : 0);

      items.push({
        id: inv._id.toString(),
        productId: p._id.toString(),
        productName: p.name || 'Unnamed Product',
        sku: p.sku || '',
        category: p.category ? p.category.toString() : '',
        brand: p.brand || '',
        vehicleType: p.vehicleType || '',
        price: price,
        imageUrl: imageUrl,
        quantity: inv.quantity,
        availabilityStatus: inv.quantity > 0 ? 'IN_STOCK' : 'OUT_OF_STOCK',
        updatedAt: inv.updatedAt,
      });
    }

    if (query.search && query.search.trim()) {
      const searchLower = query.search.trim().toLowerCase();
      items = items.filter(
        (i) =>
          i.productName.toLowerCase().includes(searchLower) ||
          i.sku.toLowerCase().includes(searchLower) ||
          i.category.toLowerCase().includes(searchLower)
      );
    }

    return {
      location: {
        id: location._id.toString(),
        name: location.name,
        radiusKm: location.radiusKm,
        latitude: location.latitude,
        longitude: location.longitude,
        isActive: location.isActive,
      },
      items,
    };
  },

  /**
   * Add or update inventory stock for a product in a location (upsert)
   */
  updateInventoryStock: async (locationId, productId, quantity) => {
    const location = await Location.findById(locationId);
    if (!location) {
      throw new AppError('Location not found.', 404);
    }

    const product = await Products.findById(productId);
    if (!product || product.isDeleted) {
      throw new AppError('Product not found or inactive.', 404);
    }

    const qty = Number(quantity);
    if (isNaN(qty) || qty < 0) {
      throw new AppError('Quantity must be a valid number >= 0', 400);
    }

    const inventory = await LocationInventory.findOneAndUpdate(
      { locationId, productId },
      { quantity: qty, isActive: true },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );

    const imageUrl =
      Array.isArray(product.images) && product.images.length > 0 ? (product.images[0].url || product.images[0]) : '';
    const price = product.priceInPaise ? product.priceInPaise / 100.0 : (product.sellingPrice ? product.sellingPrice / 100.0 : 0);

    return {
      id: inventory._id.toString(),
      productId: product._id.toString(),
      productName: product.name || 'Unnamed Product',
      sku: product.sku || '',
      category: product.category ? product.category.toString() : '',
      brand: product.brand || '',
      vehicleType: product.vehicleType || '',
      price: price,
      imageUrl: imageUrl,
      quantity: inventory.quantity,
      availabilityStatus: inventory.quantity > 0 ? 'IN_STOCK' : 'OUT_OF_STOCK',
      updatedAt: inventory.updatedAt,
    };
  },

  /**
   * Remove inventory record for a product in a location
   */
  deleteInventoryRecord: async (locationId, productId) => {
    const location = await Location.findById(locationId);
    if (!location) {
      throw new AppError('Location not found.', 404);
    }

    await LocationInventory.findOneAndDelete({ locationId, productId });
    return true;
  },
};

export default locationsService;
