import authService from './auth.service.js';
import sendResponse from '../../utils/response.js';
import catchAsync from '../../utils/catchAsync.js';

export class AuthController {
  adminLogin = catchAsync(async (req, res) => {
    const { email, password } = req.body;
    const ip = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'] || '';

    const { user, accessToken, refreshToken } = await authService.adminLogin(email, password, ip, userAgent);

    return sendResponse(res, 200, 'Admin login successful', {
      user,
      accessToken,
      refreshToken,
    });
  });

  customerRegister = catchAsync(async (req, res) => {
    const { user, accessToken, refreshToken } = await authService.customerRegister(req.body);

    return sendResponse(res, 201, 'Customer registered successfully', {
      user,
      accessToken,
      refreshToken,
    });
  });

  customerLogin = catchAsync(async (req, res) => {
    const { email, password } = req.body;
    const ip = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'] || '';

    const { user, accessToken, refreshToken } = await authService.customerLogin(email, password, ip, userAgent);

    return sendResponse(res, 200, 'Customer login successful', {
      user,
      accessToken,
      refreshToken,
    });
  });

  refreshToken = catchAsync(async (req, res) => {
    const { refreshToken: oldToken } = req.body;
    const { accessToken, refreshToken: newRefreshToken } = await authService.refreshToken(oldToken);

    return sendResponse(res, 200, 'Token refreshed successfully', {
      accessToken,
      refreshToken: newRefreshToken,
    });
  });

  logout = catchAsync(async (req, res) => {
    const { refreshToken } = req.body;
    await authService.logout(refreshToken);

    return sendResponse(res, 200, 'Logged out successfully');
  });

  logoutAll = catchAsync(async (req, res) => {
    await authService.logoutAll(req.user._id);

    return sendResponse(res, 200, 'Logged out from all sessions successfully');
  });

  getMe = catchAsync(async (req, res) => {
    // Populate role/permissions if necessary, they are already attached in protect middleware
    return sendResponse(res, 200, 'Profile retrieved successfully', {
      user: req.user,
      permissions: req.permissions,
    });
  });

  forgotPassword = catchAsync(async (req, res) => {
    const { email } = req.body;
    const result = await authService.forgotPassword(email);

    return sendResponse(res, 200, result.message, { token: result.token });
  });

  resetPassword = catchAsync(async (req, res) => {
    const { token, password } = req.body;
    await authService.resetPassword(token, password);

    return sendResponse(res, 200, 'Password has been reset successfully');
  });

  changePassword = catchAsync(async (req, res) => {
    const { oldPassword, newPassword } = req.body;
    await authService.changePassword(req.user._id, oldPassword, newPassword);

    return sendResponse(res, 200, 'Password has been changed successfully');
  });

  sendOtp = catchAsync(async (req, res) => {
    const { email, phone } = req.body;
    const identifier = email || phone;
    const result = await authService.sendOtp(identifier);

    return sendResponse(res, 200, 'OTP sent successfully', result);
  });

  verifyOtp = catchAsync(async (req, res) => {
    const { identifier, otp } = req.body;
    await authService.verifyOtp(identifier, otp);

    return sendResponse(res, 200, 'OTP verified successfully');
  });
}

export default new AuthController();
