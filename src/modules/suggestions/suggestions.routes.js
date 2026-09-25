import { Router } from 'express';
import suggestionsController from './suggestions.controller.js';
import protect from '../../middlewares/auth.middleware.js';
import restrictTo from '../../middlewares/permission.middleware.js';

const router = Router();
const adminRouter = Router();

// Optional authentication middleware for customer submission
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return protect(req, res, next);
    }
  } catch (_) {}
  next();
};

// Customer routes
router.post('/', optionalAuth, suggestionsController.createSuggestion);
router.post('/submit', optionalAuth, suggestionsController.createSuggestion);

// Admin routes
adminRouter.use(protect);
adminRouter.use(restrictTo('admin', 'staff', 'superadmin', 'owner'));

adminRouter.get('/', suggestionsController.getAllSuggestions);
adminRouter.get('/:id', suggestionsController.getSuggestionById);
adminRouter.patch('/:id/status', suggestionsController.updateStatus);
adminRouter.delete('/:id', suggestionsController.deleteSuggestion);

export { adminRouter as adminSuggestionsRouter };
export default router;
