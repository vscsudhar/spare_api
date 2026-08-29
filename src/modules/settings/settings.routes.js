import { Router } from 'express';
import settingsController from './settings.controller.js';
import validate from '../../middlewares/validate.js';
import protect from '../../middlewares/auth.middleware.js';
import restrictTo from '../../middlewares/permission.middleware.js';
import { upload } from '../../utils/storage.js';
import {
  updateGeneralSchema,
  updateBillingSchema,
  updatePosSchema,
  updateInventorySchema,
  updateNotificationsSchema,
  updateAppearanceSchema,
  updateSecuritySchema,
} from './settings.validator.js';

const router = Router();
router.use(protect);

// Read settings (accessible by all staff/admin)
router.get('/', settingsController.getSettings);

// Write settings (restricted to settings.manage permission)
router.use(restrictTo('settings.manage'));

router.patch('/general', validate(updateGeneralSchema), settingsController.updateGeneral);
router.patch('/billing', validate(updateBillingSchema), settingsController.updateBilling);
router.patch('/pos', validate(updatePosSchema), settingsController.updatePos);
router.patch('/inventory', validate(updateInventorySchema), settingsController.updateInventory);
router.patch('/notifications', validate(updateNotificationsSchema), settingsController.updateNotifications);
router.patch('/appearance', validate(updateAppearanceSchema), settingsController.updateAppearance);
router.patch('/security', validate(updateSecuritySchema), settingsController.updateSecurity);
router.post('/logo', upload.single('logo'), settingsController.uploadLogo);

export default router;
