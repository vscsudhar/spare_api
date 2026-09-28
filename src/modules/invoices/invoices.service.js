import Invoice from './invoices.model.js';
import Order from '../orders/orders.model.js';
import Users from '../users/users.model.js';
import Settings from '../settings/settings.model.js';
import AppError from '../../errors/AppError.js';
import { generateInvoiceNumber, buildInvoiceDataFromOrder, getStateCode, toRupees, convertAmountToWords } from './invoices.helper.js';

function syncBusinessAndNormalize(invoiceDoc, orderDoc, settingsDoc) {
  if (!invoiceDoc) return;
  
  // 1. Sync Business settings from general parameters
  if (settingsDoc?.general) {
    const g = settingsDoc.general;
    const businessState = g.state || 'Karnataka';
    const businessStateCode = g.stateCode || getStateCode(businessState);

    invoiceDoc.business = {
      name: g.appName || 'VoltSpare Headquarters',
      legalName: g.legalName || g.appName || 'VoltSpare Automotive Technologies Pvt. Ltd.',
      addressLine1: g.addressLine1 || g.address || '12, MG Road, Landmark Block',
      addressLine2: g.addressLine2 || 'Indiranagar Commercial Zone',
      city: g.city || 'Bangalore',
      state: businessState,
      stateCode: businessStateCode,
      postalCode: g.postalCode || g.pincode || '560001',
      phone: g.supportPhone || '+91 99000 88000',
      email: g.supportEmail || 'billing@voltspare.com',
      gstin: g.gstin || g.gstNumber || '29AAAAA0000A1Z1',
      pan: g.pan || 'AAAAA0000A',
      website: g.website || 'www.voltspare.com',
      latitude: g.latitude ?? 12.9716,
      longitude: g.longitude ?? 77.5946,
    };
  }

  // 2. Sync Payment Method from order if present
  if (orderDoc?.paymentMethod && (!invoiceDoc.paymentMethod || invoiceDoc.paymentMethod === 'Online / Card / UPI' || invoiceDoc.paymentMethod === 'Online Payment')) {
    invoiceDoc.paymentMethod = orderDoc.paymentMethod;
  }

  const isIntraState = invoiceDoc.isIntraState ?? true;

  // 3. Ensure items have actualPrice, sellingPrice, taxableValue, taxAmount, and total
  if (Array.isArray(invoiceDoc.items)) {
    invoiceDoc.items = invoiceDoc.items.map((it) => {
      const itObj = it.toObject ? it.toObject() : it;
      const qty = itObj.quantity > 0 ? itObj.quantity : 1;
      
      let rawSelling = itObj.sellingPrice ?? itObj.unitPrice ?? 0;
      if (rawSelling > 1000) rawSelling = toRupees(rawSelling);
      if (rawSelling === 0 && itObj.total) {
        rawSelling = (itObj.total > 1000 ? toRupees(itObj.total) : itObj.total) / qty;
      }
      
      const lineProductAmount = Math.round(rawSelling * qty * 100) / 100;
      const taxRate = itObj.taxPercentage ?? 18;

      const actualPrice = Math.round((rawSelling / (1.0 + (taxRate / 100.0))) * 100) / 100;
      const taxableValue = Math.round((actualPrice * qty) * 100) / 100;
      const totalTax = Math.round((lineProductAmount - taxableValue) * 100) / 100;

      let cgstRate = 0, cgstAmount = 0, sgstRate = 0, sgstAmount = 0, igstRate = 0, igstAmount = 0;
      if (isIntraState) {
        cgstRate = taxRate / 2.0;
        cgstAmount = Math.round((totalTax / 2.0) * 100) / 100;
        sgstRate = taxRate / 2.0;
        sgstAmount = Math.round((totalTax - cgstAmount) * 100) / 100;
      } else {
        igstRate = taxRate;
        igstAmount = totalTax;
      }

      return {
        ...itObj,
        actualPrice,
        sellingPrice: rawSelling,
        unitPrice: rawSelling,
        taxableValue,
        amount: lineProductAmount,
        taxAmount: totalTax,
        tax: totalTax,
        cgstRate,
        cgstAmount,
        sgstRate,
        sgstAmount,
        igstRate,
        igstAmount,
        total: lineProductAmount,
      };
    });
  }

  // 4. Normalize totals
  const totalCgst = Math.round(invoiceDoc.items.reduce((acc, i) => acc + (i.cgstAmount || 0), 0) * 100) / 100;
  const totalSgst = Math.round(invoiceDoc.items.reduce((acc, i) => acc + (i.sgstAmount || 0), 0) * 100) / 100;
  const totalIgst = Math.round(invoiceDoc.items.reduce((acc, i) => acc + (i.igstAmount || 0), 0) * 100) / 100;
  const totalTax = Math.round((totalCgst + totalSgst + totalIgst) * 100) / 100;

  const productAmount = Math.round(invoiceDoc.items.reduce((acc, i) => acc + (i.total || 0), 0) * 100) / 100;
  const taxableAmount = Math.round(invoiceDoc.items.reduce((acc, i) => acc + (i.taxableValue || 0), 0) * 100) / 100;

  let deliveryCharge = orderDoc?.deliveryFee ? toRupees(orderDoc.deliveryFee) : (invoiceDoc.deliveryCharge ?? invoiceDoc.deliveryFee ?? 0);
  if (deliveryCharge > 1000) deliveryCharge = toRupees(deliveryCharge);

  let discount = orderDoc?.discountAmount ? toRupees(orderDoc.discountAmount) : (invoiceDoc.discount ?? invoiceDoc.discountAmount ?? 0);
  if (discount > 1000) discount = toRupees(discount);

  // Grand Total = productAmount + deliveryCharge - discount (Tax is ALREADY in productAmount and NEVER added on top)
  const grandTotal = Math.round((productAmount + deliveryCharge - discount) * 100) / 100;

  invoiceDoc.productAmount = productAmount;
  invoiceDoc.subtotal = productAmount;
  invoiceDoc.subTotal = productAmount;
  invoiceDoc.taxableAmount = taxableAmount;
  invoiceDoc.taxableSubtotal = taxableAmount;
  invoiceDoc.taxAmount = totalTax;
  invoiceDoc.tax = totalTax;
  invoiceDoc.totalCgst = totalCgst;
  invoiceDoc.cgst = totalCgst;
  invoiceDoc.totalSgst = totalSgst;
  invoiceDoc.sgst = totalSgst;
  invoiceDoc.totalIgst = totalIgst;
  invoiceDoc.igst = totalIgst;
  invoiceDoc.totalTax = totalTax;
  invoiceDoc.deliveryCharge = deliveryCharge;
  invoiceDoc.deliveryFee = deliveryCharge;
  invoiceDoc.discount = discount;
  invoiceDoc.discountAmount = discount;
  invoiceDoc.grandTotal = grandTotal;
  invoiceDoc.amountInWords = convertAmountToWords(grandTotal);
}

export const invoicesService = {
  /**
   * Get invoice for a specific order. If not created yet, generates and persists it atomically.
   */
  getOrCreateInvoiceForOrder: async (orderId, requestingUserId, requestingUserRole, isOwner = false) => {
    // 1. Fetch Order
    const order = await Order.findById(orderId).populate('items.product');
    if (!order) {
      throw new AppError('Order not found', 404);
    }

    // 2. Security / Authorization Check
    const isOrderCustomer = order.user && order.user.toString() === requestingUserId.toString();
    const isAdminOrStaff =
      isOwner ||
      ['admin', 'manager', 'owner', 'super_admin', 'staff'].includes(requestingUserRole?.name || requestingUserRole);

    if (!isOrderCustomer && !isAdminOrStaff) {
      throw new AppError('You do not have permission to view the invoice for this order.', 403);
    }

    const settingsDoc = await Settings.findOne();

    // 3. Check if invoice already exists
    let existingInvoice = await Invoice.findOne({ order: order._id });
    if (existingInvoice) {
      syncBusinessAndNormalize(existingInvoice, order, settingsDoc);
      await existingInvoice.save().catch(() => {});
      return existingInvoice;
    }

    // 4. Generate new invoice from historical order snapshot
    const userDoc = await Users.findById(order.user);

    const invoiceData = buildInvoiceDataFromOrder(order, userDoc, settingsDoc);
    invoiceData.invoiceNumber = await generateInvoiceNumber();
    invoiceData.invoiceDate = new Date();

    try {
      const createdInvoice = await Invoice.create(invoiceData);
      return createdInvoice;
    } catch (err) {
      // Catch concurrent create race condition (Mongo E11000 duplicate key error)
      if (err.code === 11000) {
        const found = await Invoice.findOne({ order: order._id });
        if (found) {
          syncBusinessAndNormalize(found, order, settingsDoc);
          await found.save().catch(() => {});
          return found;
        }
      }
      throw err;
    }
  },

  /**
   * Get invoice by Invoice ID or Invoice Number
   */
  getInvoiceById: async (idOrNumber, requestingUserId, requestingUserRole, isOwner = false) => {
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(idOrNumber);
    const query = isObjectId ? { $or: [{ _id: idOrNumber }, { invoiceNumber: idOrNumber }] } : { invoiceNumber: idOrNumber };

    const invoice = await Invoice.findOne(query).populate('order').populate('user', 'name email phone');
    if (!invoice) {
      throw new AppError('Invoice not found', 404);
    }

    const isOrderCustomer = invoice.user && (invoice.user._id || invoice.user).toString() === requestingUserId.toString();
    const isAdminOrStaff =
      isOwner ||
      ['admin', 'manager', 'owner', 'super_admin', 'staff'].includes(requestingUserRole?.name || requestingUserRole);

    if (!isOrderCustomer && !isAdminOrStaff) {
      throw new AppError('You do not have permission to view this invoice.', 403);
    }

    const settingsDoc = await Settings.findOne();
    syncBusinessAndNormalize(invoice, invoice.order, settingsDoc);
    await invoice.save().catch(() => {});

    return invoice;
  },

  /**
   * Admin / Staff List all invoices with pagination
   */
  getAllInvoices: async (queryParams = {}) => {
    const { page = 1, limit = 20, search = '', startDate, endDate } = queryParams;
    const filter = {};

    if (search) {
      filter.$or = [
        { invoiceNumber: { $regex: search, $options: 'i' } },
        { orderNumber: { $regex: search, $options: 'i' } },
        { 'customer.name': { $regex: search, $options: 'i' } },
        { 'customer.phone': { $regex: search, $options: 'i' } },
      ];
    }

    if (startDate || endDate) {
      filter.invoiceDate = {};
      if (startDate) filter.invoiceDate.$gte = new Date(startDate);
      if (endDate) filter.invoiceDate.$lte = new Date(endDate);
    }

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const total = await Invoice.countDocuments(filter);
    const invoices = await Invoice.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10))
      .populate('user', 'name email phone');

    return {
      invoices,
      pagination: {
        total,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        pages: Math.ceil(total / parseInt(limit, 10)),
      },
    };
  },
};

export default invoicesService;
