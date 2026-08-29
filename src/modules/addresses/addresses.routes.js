import { Router } from 'express';
import addressesController from './addresses.controller.js';
import validate from '../../middlewares/validate.js';
import protect from '../../middlewares/auth.middleware.js';
import {
  idParamSchema,
  createAddressSchema,
  updateAddressSchema,
} from './addresses.validator.js';

const router = Router();

// Protect all address routes
router.use(protect);

router.get('/', addressesController.getAll);
router.post('/', validate(createAddressSchema), addressesController.create);
router.patch('/:id', validate(updateAddressSchema), addressesController.update);
router.delete('/:id', validate(idParamSchema), addressesController.delete);
router.patch('/:id/default', validate(idParamSchema), addressesController.setDefault);

export default router;
