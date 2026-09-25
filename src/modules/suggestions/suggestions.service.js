import AppError from '../../errors/AppError.js';
import Suggestion from './suggestions.model.js';

export const suggestionsService = {
  createSuggestion: async (userId, data) => {
    const { name, phone, suggestion } = data;
    if (!name || !phone || !suggestion) {
      throw new AppError('Name, phone number and suggestion text are required', 400);
    }

    const doc = await Suggestion.create({
      user: userId || null,
      name: name.trim(),
      phone: phone.trim(),
      suggestion: suggestion.trim(),
      status: 'pending',
    });

    return doc;
  },

  getAllSuggestions: async (query = {}) => {
    const filter = {};
    if (query.status && query.status !== 'all') {
      filter.status = query.status;
    }
    if (query.search) {
      const regex = new RegExp(query.search, 'i');
      filter.$or = [{ name: regex }, { phone: regex }, { suggestion: regex }];
    }

    const suggestions = await Suggestion.find(filter)
      .populate('user', 'name email phone profileImage')
      .sort({ createdAt: -1 });

    return suggestions;
  },

  getSuggestionById: async (id) => {
    const doc = await Suggestion.findById(id).populate('user', 'name email phone profileImage');
    if (!doc) {
      throw new AppError('Suggestion not found', 404);
    }
    return doc;
  },

  updateStatus: async (id, status, adminNotes = '') => {
    const doc = await Suggestion.findById(id);
    if (!doc) {
      throw new AppError('Suggestion not found', 404);
    }
    if (status) doc.status = status;
    if (adminNotes !== undefined) doc.adminNotes = adminNotes;
    await doc.save();
    return doc;
  },

  deleteSuggestion: async (id) => {
    const doc = await Suggestion.findByIdAndDelete(id);
    if (!doc) {
      throw new AppError('Suggestion not found', 404);
    }
    return { id };
  },
};

export default suggestionsService;
