import catchAsync from '../../utils/catchAsync.js';
import enquiriesService from './enquiries.service.js';

export const enquiriesController = {
  createEnquiry: catchAsync(async (req, res) => {
    const userId = req.user ? req.user._id : null;
    const data = await enquiriesService.createEnquiry(userId, req.body);
    res.status(201).json({
      success: true,
      message: 'Enquiry submitted successfully! Our team will contact you shortly.',
      data,
    });
  }),

  getAllEnquiries: catchAsync(async (req, res) => {
    const enquiries = await enquiriesService.getAllEnquiries(req.query);
    res.status(200).json({
      success: true,
      message: 'Enquiries retrieved successfully',
      data: enquiries,
    });
  }),

  getEnquiryById: catchAsync(async (req, res) => {
    const enquiry = await enquiriesService.getEnquiryById(req.params.id);
    res.status(200).json({
      success: true,
      message: 'Enquiry retrieved successfully',
      data: enquiry,
    });
  }),

  updateStatus: catchAsync(async (req, res) => {
    const { status, adminNotes } = req.body;
    const updated = await enquiriesService.updateStatus(req.params.id, status, adminNotes);
    res.status(200).json({
      success: true,
      message: 'Enquiry status updated successfully',
      data: updated,
    });
  }),

  deleteEnquiry: catchAsync(async (req, res) => {
    await enquiriesService.deleteEnquiry(req.params.id);
    res.status(200).json({
      success: true,
      message: 'Enquiry deleted successfully',
      data: { id: req.params.id },
    });
  }),
};

export default enquiriesController;
