import { Router } from 'express';
import wishlistController from './wishlist.controller.js';
import validate from '../../middlewares/validate.js';
import protect from '../../middlewares/auth.middleware.js';
import { productIdParamSchema } from './wishlist.validator.js';

const router = Router();

// Protect all wishlist routes
router.use(protect);

router.get('/', wishlistController.getWishlist);
router.post('/:productId', validate(productIdParamSchema), wishlistController.addProduct);
router.delete('/:productId', validate(productIdParamSchema), wishlistController.removeProduct);
router.patch('/:productId/toggle', validate(productIdParamSchema), wishlistController.toggleWishlist);

export default router;
