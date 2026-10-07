import { Router } from 'express';
import enquiriesController from './enquiries.controller.js';
import protect from '../../middlewares/auth.middleware.js';
import restrictTo from '../../middlewares/permission.middleware.js';

const router = Router();
const adminRouter = Router();

// Optional authentication middleware for website/customer submission
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return protect(req, res, next);
    }
  } catch (_) {}
  next();
};

// Public / Website Customer routes
router.post('/', optionalAuth, enquiriesController.createEnquiry);
router.post('/submit', optionalAuth, enquiriesController.createEnquiry);

// Admin routes
adminRouter.use(protect);
adminRouter.use(restrictTo('admin', 'staff', 'superadmin', 'owner'));

adminRouter.get('/', enquiriesController.getAllEnquiries);
adminRouter.get('/:id', enquiriesController.getEnquiryById);
adminRouter.patch('/:id/status', enquiriesController.updateStatus);
adminRouter.delete('/:id', enquiriesController.deleteEnquiry);

export { adminRouter as adminEnquiriesRouter };
export default router;
