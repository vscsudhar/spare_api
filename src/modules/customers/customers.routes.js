import { Router } from 'express';
import customersController from './customers.controller.js';
import validate from '../../middlewares/validate.js';
import protect from '../../middlewares/auth.middleware.js';
import restrictTo from '../../middlewares/permission.middleware.js';
import {
  idParamSchema,
  updateMeSchema,
  updateStatusSchema,
} from './customers.validator.js';

const router = Router();

// Secure all customer endpoints
router.use(protect);

// Self endpoints
router.get('/me', customersController.getMe);
router.patch('/me', validate(updateMeSchema), customersController.updateMe);
router.get('/vehicles', customersController.getVehicles);
router.post('/vehicles', customersController.addVehicle);
router.put('/vehicles/:id', customersController.updateVehicle);
router.delete('/vehicles/:id', customersController.deleteVehicle);

// Administrative management endpoints
router.get('/', restrictTo('staff.manage'), customersController.getAll);
router.get('/:id', restrictTo('staff.manage'), validate(idParamSchema), customersController.getById);
router.patch('/:id/status', restrictTo('staff.manage'), validate(updateStatusSchema), customersController.updateStatus);

export default router;
