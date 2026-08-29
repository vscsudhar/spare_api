import { Router } from 'express';
import authController from './auth.controller.js';
import validate from '../../middlewares/validate.js';
import protect from '../../middlewares/auth.middleware.js';
import loginLimiter from '../../middlewares/rateLimiter.js';
import {
  adminLoginSchema,
  customerRegisterSchema,
  customerLoginSchema,
  refreshTokenSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  sendOtpSchema,
  verifyOtpSchema,
} from './auth.validator.js';

const router = Router();

// Rate limited endpoints
router.post('/admin/login', loginLimiter, validate(adminLoginSchema), authController.adminLogin);
router.post('/customer/login', loginLimiter, validate(customerLoginSchema), authController.customerLogin);

// Standard auth endpoints
router.post('/customer/register', validate(customerRegisterSchema), authController.customerRegister);
router.post('/refresh-token', validate(refreshTokenSchema), authController.refreshToken);
router.post('/logout', authController.logout);

// Password recovery endpoints
router.post('/forgot-password', validate(forgotPasswordSchema), authController.forgotPassword);
router.post('/reset-password', validate(resetPasswordSchema), authController.resetPassword);

// OTP endpoints
router.post('/send-otp', validate(sendOtpSchema), authController.sendOtp);
router.post('/verify-otp', validate(verifyOtpSchema), authController.verifyOtp);

// Authenticated endpoints
router.use(protect);

router.post('/logout-all', authController.logoutAll);
router.get('/me', authController.getMe);
router.patch('/change-password', validate(changePasswordSchema), authController.changePassword);

export default router;
