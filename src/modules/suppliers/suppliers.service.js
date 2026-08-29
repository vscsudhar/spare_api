import AppError from '../../errors/AppError.js';
import { Supplier, SupplierProduct, SupplierPayment } from './suppliers.model.js';
import Products from '../products/products.model.js';
import PurchaseOrder from '../purchases/purchases.model.js';

export const suppliersService = {
  /**
   * Get all suppliers
   */
  getAll: async () => {
    return Supplier.find();
  },

  /**
   * Get Supplier by ID
   */
  getById: async (id) => {
    const supplier = await Supplier.findById(id);
    if (!supplier) {
      throw new AppError('Supplier not found.', 404);
    }
    return supplier;
  },

  /**
   * Create Supplier
   */
  create: async (data) => {
    // Check name and code uniqueness
    const nameExists = await Supplier.findOne({ name: data.name });
    if (nameExists) {
      throw new AppError('Supplier with this name already exists.', 400);
    }

    const codeExists = await Supplier.findOne({ code: data.code.toUpperCase() });
    if (codeExists) {
      throw new AppError('Supplier with this code already exists.', 400);
    }

    return Supplier.create(data);
  },

  /**
   * Update Supplier
   */
  update: async (id, data) => {
    const supplier = await Supplier.findById(id);
    if (!supplier) {
      throw new AppError('Supplier not found.', 404);
    }

    if (data.name && data.name !== supplier.name) {
      const nameExists = await Supplier.findOne({ _id: { $ne: id }, name: data.name });
      if (nameExists) {
        throw new AppError('Supplier with this name already exists.', 400);
      }
      supplier.name = data.name;
    }

    if (data.code && data.code.toUpperCase() !== supplier.code) {
      const codeExists = await Supplier.findOne({ _id: { $ne: id }, code: data.code.toUpperCase() });
      if (codeExists) {
        throw new AppError('Supplier with this code already exists.', 400);
      }
      supplier.code = data.code.toUpperCase();
    }

    // Set other fields directly
    const directFields = [
      'email',
      'phone',
      'gstNumber',
      'address',
      'city',
      'state',
      'bankDetails',
      'upiId',
      'creditLimit',
      'paymentTerms',
      'vehicleCategories',
      'contacts',
    ];

    directFields.forEach((field) => {
      if (data[field] !== undefined) {
        supplier[field] = data[field];
      }
    });

    return supplier.save();
  },

  /**
   * Delete Supplier
   */
  delete: async (id) => {
    const result = await Supplier.findByIdAndDelete(id);
    if (!result) {
      throw new AppError('Supplier not found.', 404);
    }
  },

  /**
   * Toggle supplier status
   */
  updateStatus: async (id, status) => {
    const supplier = await Supplier.findById(id);
    if (!supplier) {
      throw new AppError('Supplier not found.', 404);
    }
    supplier.status = status;
    return supplier.save();
  },

  /**
   * List all products mapped to a supplier
   */
  getProducts: async (supplierId) => {
    await suppliersService.getById(supplierId); // Ensure supplier exists
    return SupplierProduct.find({ supplier: supplierId }).populate('product');
  },

  /**
   * Create or update supplier-product mapping
   */
  createProduct: async (supplierId, data) => {
    await suppliersService.getById(supplierId); // Ensure supplier exists

    const product = await Products.findById(data.productId);
    if (!product) {
      throw new AppError('Product not found.', 404);
    }

    // Upsert mapping
    return SupplierProduct.findOneAndUpdate(
      { supplier: supplierId, product: data.productId },
      {
        supplierSku: data.supplierSku || '',
        lastPurchasePrice: data.lastPurchasePrice || 0,
      },
      { upsert: true, new: true }
    );
  },

  /**
   * List all purchase orders matching a supplier
   */
  getPurchases: async (supplierId) => {
    await suppliersService.getById(supplierId); // Ensure supplier exists
    return PurchaseOrder.find({ supplier: supplierId }).populate('user');
  },

  /**
   * List payments made to a supplier
   */
  getPayments: async (supplierId) => {
    await suppliersService.getById(supplierId); // Ensure supplier exists
    return SupplierPayment.find({ supplier: supplierId });
  },

  /**
   * Record a payment to a supplier
   */
  createPayment: async (supplierId, paymentData) => {
    const supplier = await Supplier.findById(supplierId);
    if (!supplier) {
      throw new AppError('Supplier not found.', 404);
    }

    // 1. Log the payment doc
    const payment = await SupplierPayment.create({
      supplier: supplierId,
      amount: paymentData.amount,
      paymentDate: paymentData.paymentDate,
      paymentMethod: paymentData.paymentMethod,
      transactionReference: paymentData.transactionReference,
      notes: paymentData.notes,
    });

    // 2. Reduce the supplier's outstanding balance
    supplier.outstandingBalance -= paymentData.amount;
    await supplier.save();

    return payment;
  },
};

export default suppliersService;
