import Invoice from './invoices.model.js';
import Settings from '../settings/settings.model.js';

/**
 * Map Indian state name to official 2-digit GST state code
 */
export function getStateCode(stateName = '') {
  const s = (stateName || '').toLowerCase().trim();
  if (s.includes('karnataka') || s.includes('bangalore') || s.includes('blr')) return '29';
  if (s.includes('tamil') || s.includes('chennai') || s.includes('coimbatore') || s.includes('tn')) return '33';
  if (s.includes('maharashtra') || s.includes('mumbai') || s.includes('pune')) return '27';
  if (s.includes('delhi') || s.includes('ncr')) return '07';
  if (s.includes('telangana') || s.includes('hyderabad')) return '36';
  if (s.includes('andhra')) return '37';
  if (s.includes('kerala') || s.includes('kochi')) return '32';
  if (s.includes('gujarat') || s.includes('ahmedabad')) return '24';
  if (s.includes('uttar pradesh') || s.includes('up') || s.includes('noida') || s.includes('lucknow')) return '09';
  if (s.includes('rajasthan') || s.includes('jaipur')) return '08';
  if (s.includes('west bengal') || s.includes('kolkata')) return '19';
  if (s.includes('haryana') || s.includes('gurgaon') || s.includes('gurugram')) return '06';
  if (s.includes('punjab') || s.includes('chandigarh')) return '03';
  if (s.includes('madhya') || s.includes('bhopal') || s.includes('indore')) return '23';
  if (s.includes('bihar') || s.includes('patna')) return '10';
  if (s.includes('odisha') || s.includes('orissa') || s.includes('bhubaneswar')) return '21';
  if (s.includes('goa')) return '30';
  return '33'; // Default to Tamil Nadu
}

function convertNumberToWords(number) {
  if (number === 0) return 'Zero';

  const units = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen'
  ];

  const tens = [
    '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'
  ];

  function formatUnderThousand(n) {
    let str = '';
    if (n >= 100) {
      str += units[Math.floor(n / 100)] + ' Hundred ';
      n %= 100;
    }
    if (n >= 20) {
      str += tens[Math.floor(n / 10)] + ' ';
      n %= 10;
    }
    if (n > 0) {
      str += units[n] + ' ';
    }
    return str.trim();
  }

  let result = '';

  if (number >= 10000000) {
    const crores = Math.floor(number / 10000000);
    result += formatUnderThousand(crores) + ' Crore ';
    number %= 10000000;
  }

  if (number >= 100000) {
    const lakhs = Math.floor(number / 100000);
    result += formatUnderThousand(lakhs) + ' Lakh ';
    number %= 100000;
  }

  if (number >= 1000) {
    const thousands = Math.floor(number / 1000);
    result += formatUnderThousand(thousands) + ' Thousand ';
    number %= 1000;
  }

  if (number > 0) {
    result += formatUnderThousand(number);
  }

  return result.trim();
}

/**
 * Converts numeric amount in Rupees to Indian Currency Words
 */
export function convertAmountToWords(amount) {
  if (!amount || amount <= 0) return 'Indian Rupees Zero Only';

  const wholePart = Math.floor(amount);
  const decimalPart = Math.round((amount - wholePart) * 100);

  const words = convertNumberToWords(wholePart);
  let result = `Indian Rupees ${words}`;

  if (decimalPart > 0) {
    const paiseWords = convertNumberToWords(decimalPart);
    result += ` and ${paiseWords} Paise`;
  }

  return `${result} Only`;
}

/**
 * Convert values stored in paise (database standard) to Rupees
 */
export function toRupees(val) {
  if (val === null || val === undefined) return 0;
  const num = typeof val === 'number' ? val : Number(val) || 0;
  if (num >= 10000 && num % 100 === 0) {
    return Math.round((num / 100.0) * 100) / 100;
  }
  if (num > 1000 && num % 100 === 0) {
    return Math.round((num / 100.0) * 100) / 100;
  }
  return Math.round(num * 100) / 100;
}

/**
 * Generate a unique, sequential and persistent invoice number
 * Format: INV-YYYY-000001 or configured prefix
 */
export async function generateInvoiceNumber(session = null) {
  const currentYear = new Date().getFullYear();
  const settings = (await Settings.findOne().session(session)) || {};
  const prefix = settings.billing?.invoicePrefix || 'INV-';

  const searchPattern = new RegExp(`^${prefix}${currentYear}-(\\d+)$`, 'i');
  
  const query = Invoice.find({ invoiceNumber: searchPattern }).sort({ invoiceNumber: -1 }).limit(1);
  if (session) query.session(session);
  const latestInvoice = await query;

  let nextSequence = 1;
  if (latestInvoice && latestInvoice.length > 0) {
    const match = latestInvoice[0].invoiceNumber.match(searchPattern);
    if (match && match[1]) {
      nextSequence = parseInt(match[1], 10) + 1;
    }
  } else {
    const countQuery = Invoice.countDocuments({
      createdAt: {
        $gte: new Date(`${currentYear}-01-01T00:00:00.000Z`),
        $lte: new Date(`${currentYear}-12-31T23:59:59.999Z`),
      },
    });
    if (session) countQuery.session(session);
    const count = await countQuery;
    nextSequence = count + 1;
  }

  const paddedSequence = String(nextSequence).padStart(6, '0');
  return `${prefix}${currentYear}-${paddedSequence}`;
}

/**
 * Build invoice payload strictly from historical Order snapshot data:
 * - sellingPrice = GST-INCLUSIVE unit price (e.g. ?350.00)
 * - actualPrice = GST-EXCLUSIVE unit price (e.g. ?296.61)
 * - taxableValue = actualPrice * quantity (e.g. ?296.61)
 * - taxAmount = total tax breakdown included in selling price (e.g. ?53.39)
 * - productAmount = sellingPrice * quantity (e.g. ?350.00)
 * - deliveryCharge = orderDoc.deliveryFee (e.g. ?59.00)
 * - grandTotal = productAmount + deliveryCharge - discount (e.g. ?409.00)
 * Tax is ALREADY in productAmount and NEVER added on top.
 */
export function buildInvoiceDataFromOrder(orderDoc, userDoc, settingsDoc) {
  const g = settingsDoc?.general || {};
  const businessState = g.state || 'Karnataka';
  const businessStateCode = g.stateCode || getStateCode(businessState);

  const business = {
    name: g.appName || 'VoltSpare Headquarters',
    legalName: g.legalName || g.appName || 'VoltSpare Automotive Technologies Pvt. Ltd.',
    addressLine1: g.addressLine1 || g.address || '12, MG Road, Landmark Block',
    addressLine2: g.addressLine2 || 'Indiranagar Commercial Zone',
    city: g.city || 'Bangalore',
    state: businessState,
    stateCode: businessStateCode,
    postalCode: g.postalCode || g.pincode || '641105',
    phone: g.supportPhone || '+91 99000 88000',
    email: g.supportEmail || 'billing@voltspare.com',
    gstin: g.gstin || g.gstNumber || '29AAAAA0000A1Z1',
    pan: g.pan || 'AAAAA0000A',
    website: g.website || 'www.voltspare.com',
    latitude: g.latitude ?? 12.9716,
    longitude: g.longitude ?? 77.5946,
  };

  const addressSnapshot = orderDoc.shippingAddress || {};
  const customerState = addressSnapshot.state || 'Tamil Nadu';
  const customerStateCode = getStateCode(customerState);
  const isIntraState = customerStateCode === business.stateCode;

  const customer = {
    name: addressSnapshot.recipientName || userDoc?.name || 'Valued Customer',
    phone: addressSnapshot.phone || userDoc?.phone || '',
    address: [
      addressSnapshot.addressLine1,
      addressSnapshot.addressLine2,
      addressSnapshot.city,
      addressSnapshot.state,
      addressSnapshot.postalCode,
    ]
      .filter(Boolean)
      .join(', ') || 'Customer Delivery Address',
    addressLine1: addressSnapshot.addressLine1 || '',
    addressLine2: addressSnapshot.addressLine2 || '',
    city: addressSnapshot.city || '',
    state: customerState,
    stateCode: customerStateCode,
    postalCode: addressSnapshot.postalCode || '',
    country: addressSnapshot.country || 'India',
    gstin: 'URP (Unregistered Person)',
  };

  // Convert each historical order item from paise to standard Rupees
  const invoiceItems = (orderDoc.items || []).map((item) => {
    const qty = item.quantity > 0 ? item.quantity : 1;
    // Order-time tax-inclusive selling price
    const rawSellingPrice = item.unitPrice ?? item.productSnapshot?.sellingPrice ?? 0;
    const sellingPrice = toRupees(rawSellingPrice);
    const lineProductAmount = Math.round(sellingPrice * qty * 100) / 100;
    const taxRate = item.taxPercentage ?? 18;

    // actualPrice = price WITHOUT tax (tax-exclusive)
    const actualPrice = Math.round((sellingPrice / (1.0 + (taxRate / 100.0))) * 100) / 100;
    const taxableValue = Math.round((actualPrice * qty) * 100) / 100;

    // taxAmount is ALREADY INCLUDED in lineProductAmount
    const totalTax = Math.round((lineProductAmount - taxableValue) * 100) / 100;

    let cgstRate = 0;
    let cgstAmount = 0;
    let sgstRate = 0;
    let sgstAmount = 0;
    let igstRate = 0;
    let igstAmount = 0;

    if (isIntraState) {
      cgstRate = taxRate / 2.0;
      cgstAmount = Math.round((totalTax / 2.0) * 100) / 100;
      sgstRate = taxRate / 2.0;
      sgstAmount = Math.round((totalTax - cgstAmount) * 100) / 100;
    } else {
      igstRate = taxRate;
      igstAmount = totalTax;
    }

    const prodSnapshot = item.productSnapshot || {};
    const prodName = prodSnapshot.name || item.name || 'Auto Spare Part';
    const prodSku = prodSnapshot.sku || item.sku || 'SKU-UNKNOWN';

    return {
      product: item.product?._id || item.product,
      productId: (item.product?._id || item.product || '').toString(),
      productName: prodName,
      name: prodName,
      sku: prodSku,
      hsnCode: '8708',
      quantity: qty,
      actualPrice,               // Price WITHOUT tax (e.g. ?296.61)
      sellingPrice,              // Price INCLUDING tax (e.g. ?350.00)
      unitPrice: sellingPrice,   // Selling price per unit (e.g. ?350.00)
      taxableValue,              // actualPrice * quantity (e.g. ?296.61)
      amount: lineProductAmount, // sellingPrice * quantity (e.g. ?350.00)
      taxAmount: totalTax,       // Included GST breakdown (e.g. ?53.39)
      tax: totalTax,
      taxPercentage: taxRate,
      cgst: cgstAmount,
      cgstRate,
      cgstAmount,
      sgst: sgstAmount,
      sgstRate,
      sgstAmount,
      igst: igstAmount,
      igstRate,
      igstAmount,
      total: lineProductAmount,  // sellingPrice * quantity (e.g. ?350.00)
    };
  });

  // Calculate totals in clean standard Rupees
  const totalCgst = Math.round(invoiceItems.reduce((acc, i) => acc + i.cgstAmount, 0) * 100) / 100;
  const totalSgst = Math.round(invoiceItems.reduce((acc, i) => acc + i.sgstAmount, 0) * 100) / 100;
  const totalIgst = Math.round(invoiceItems.reduce((acc, i) => acc + i.igstAmount, 0) * 100) / 100;
  const totalTax = Math.round((totalCgst + totalSgst + totalIgst) * 100) / 100;

  // Product Amount = S(sellingPrice × quantity)
  const productAmount = Math.round(invoiceItems.reduce((acc, i) => acc + i.total, 0) * 100) / 100;
  // Taxable Subtotal = S(actualPrice × quantity)
  const taxableAmount = Math.round(invoiceItems.reduce((acc, i) => acc + i.taxableValue, 0) * 100) / 100;

  const discountAmount = orderDoc.discountAmount ? toRupees(orderDoc.discountAmount) : 0;
  const deliveryFee = orderDoc.deliveryFee ? toRupees(orderDoc.deliveryFee) : 0;

  // Grand Total = Product Amount + Delivery Charge - Discount
  // Tax is ALREADY in productAmount and NEVER added twice.
  const grandTotal = Math.round((productAmount + deliveryFee - discountAmount) * 100) / 100;

  const paymentMethod = orderDoc.paymentMethod || (orderDoc.paymentStatus === 'paid' ? 'Prepaid Online' : 'Cash on Delivery');

  return {
    order: orderDoc._id,
    orderNumber: orderDoc.orderNumber,
    user: orderDoc.user,
    orderDate: orderDoc.createdAt || new Date(),
    customer,
    business,
    items: invoiceItems,
    productAmount,
    subtotal: productAmount,
    subTotal: productAmount,
    taxableAmount,
    taxableSubtotal: taxableAmount,
    taxAmount: totalTax,
    tax: totalTax,
    totalCgst,
    cgst: totalCgst,
    totalSgst,
    sgst: totalSgst,
    totalIgst,
    igst: totalIgst,
    totalTax,
    discount: discountAmount,
    discountAmount,
    deliveryCharge: deliveryFee,
    deliveryFee,
    grandTotal,
    amountInWords: convertAmountToWords(grandTotal),
    isIntraState,
    paymentMethod,
    paymentStatus: (orderDoc.paymentStatus || 'unpaid').toUpperCase(),
    orderStatus: orderDoc.status || 'pending',
    channel: orderDoc.channel || 'app',
    fulfillmentHub: orderDoc.locationName || null,
  };
}
