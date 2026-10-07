import AppError from '../../errors/AppError.js';
import Enquiry from './enquiries.model.js';

export const enquiriesService = {
  createEnquiry: async (userId, data) => {
    const { name, phone, brand, model, partName, message } = data;
    if (!name || !phone) {
      throw new AppError('Customer name and phone number are required', 400);
    }

    const doc = await Enquiry.create({
      user: userId || null,
      name: name.trim(),
      phone: phone.trim(),
      brand: (brand || '').trim(),
      model: (model || '').trim(),
      partName: (partName || '').trim(),
      message: (message || '').trim(),
      status: 'pending',
    });

    return doc;
  },

  getAllEnquiries: async (query = {}) => {
    const filter = {};
    if (query.status && query.status !== 'all') {
      filter.status = query.status;
    }
    if (query.search) {
      const regex = new RegExp(query.search, 'i');
      filter.$or = [
        { name: regex },
        { phone: regex },
        { brand: regex },
        { model: regex },
        { partName: regex },
        { message: regex },
      ];
    }

    const enquiries = await Enquiry.find(filter)
      .populate('user', 'name email phone profileImage')
      .sort({ createdAt: -1 });

    return enquiries;
  },

  getEnquiryById: async (id) => {
    const doc = await Enquiry.findById(id).populate('user', 'name email phone profileImage');
    if (!doc) {
      throw new AppError('Enquiry not found', 404);
    }
    return doc;
  },

  updateStatus: async (id, status, adminNotes) => {
    const doc = await Enquiry.findById(id);
    if (!doc) {
      throw new AppError('Enquiry not found', 404);
    }
    
    // Status can be updated freely, including if currently denied
    const validStatuses = ['pending', 'call_user', 'denied', 'completed'];
    if (status && validStatuses.includes(status)) {
      doc.status = status;
    } else if (status) {
      throw new AppError(`Invalid status. Allowed values: ${validStatuses.join(', ')}`, 400);
    }
    
    if (adminNotes !== undefined) {
      doc.adminNotes = adminNotes;
    }
    
    await doc.save();
    return doc;
  },

  deleteEnquiry: async (id) => {
    const doc = await Enquiry.findByIdAndDelete(id);
    if (!doc) {
      throw new AppError('Enquiry not found', 404);
    }
    return { id };
  },
};

export default enquiriesService;
