import catchAsync from '../../utils/catchAsync.js';
import suggestionsService from './suggestions.service.js';

export const suggestionsController = {
  createSuggestion: catchAsync(async (req, res) => {
    const userId = req.user ? req.user._id : null;
    const data = await suggestionsService.createSuggestion(userId, req.body);
    res.status(201).json({
      success: true,
      message: 'Suggestion submitted successfully. Thank you for your feedback!',
      data,
    });
  }),

  getAllSuggestions: catchAsync(async (req, res) => {
    const suggestions = await suggestionsService.getAllSuggestions(req.query);
    res.status(200).json({
      success: true,
      message: 'Suggestions retrieved successfully',
      data: suggestions,
    });
  }),

  getSuggestionById: catchAsync(async (req, res) => {
    const suggestion = await suggestionsService.getSuggestionById(req.params.id);
    res.status(200).json({
      success: true,
      message: 'Suggestion retrieved successfully',
      data: suggestion,
    });
  }),

  updateStatus: catchAsync(async (req, res) => {
    const { status, adminNotes } = req.body;
    const updated = await suggestionsService.updateStatus(req.params.id, status, adminNotes);
    res.status(200).json({
      success: true,
      message: 'Suggestion status updated successfully',
      data: updated,
    });
  }),

  deleteSuggestion: catchAsync(async (req, res) => {
    await suggestionsService.deleteSuggestion(req.params.id);
    res.status(200).json({
      success: true,
      message: 'Suggestion deleted successfully',
      data: { id: req.params.id },
    });
  }),
};

export default suggestionsController;
