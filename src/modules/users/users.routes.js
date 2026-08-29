import { Router } from 'express';
import usersController from './users.controller.js';
import validate from '../../middlewares/validate.js';
import protect from '../../middlewares/auth.middleware.js';
import restrictTo from '../../middlewares/permission.middleware.js';
import {
  idParamSchema,
  createStaffSchema,
  updateStaffSchema,
  updateStaffStatusSchema,
  updateStaffRoleSchema,
  createRoleSchema,
  updateRoleSchema,
  updateProfileSchema,
} from './users.validator.js';

const router = Router();

// Profile endpoints (accessible by any authenticated user)
router.get('/users/profile', protect, usersController.getProfile);
router.put('/users/profile', protect, validate(updateProfileSchema), usersController.updateProfile);

// Staff management endpoints (restricted to staff.manage permission)
router.get('/staff', protect, restrictTo('staff.manage'), usersController.getAllStaff);
router.post('/staff', protect, restrictTo('staff.manage'), validate(createStaffSchema), usersController.createStaff);
router.get('/staff/:id', protect, restrictTo('staff.manage'), validate(idParamSchema), usersController.getStaffById);
router.patch('/staff/:id', protect, restrictTo('staff.manage'), validate(updateStaffSchema), usersController.updateStaff);
router.patch(
  '/staff/:id/status',
  protect,
  restrictTo('staff.manage'),
  validate(updateStaffStatusSchema),
  usersController.updateStaffStatus
);
router.patch(
  '/staff/:id/role',
  protect,
  restrictTo('staff.manage'),
  validate(updateStaffRoleSchema),
  usersController.updateStaffRole
);
router.delete('/staff/:id', protect, restrictTo('staff.manage'), validate(idParamSchema), usersController.deleteStaff);

// Role & Permission management endpoints (restricted to staff.manage permission)
router.get('/roles', protect, restrictTo('staff.manage'), usersController.getAllRoles);
router.post('/roles', protect, restrictTo('staff.manage'), validate(createRoleSchema), usersController.createRole);
router.patch('/roles/:id', protect, restrictTo('staff.manage'), validate(updateRoleSchema), usersController.updateRole);
router.get('/permissions', protect, restrictTo('staff.manage'), usersController.getAllPermissions);

export default router;
