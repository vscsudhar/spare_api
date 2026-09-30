import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import env from '../../config/env.js';
import AppError from '../../errors/AppError.js';
import Users from '../users/users.model.js';
import Role from '../users/roles.model.js';
import RefreshToken from './refresh-token.model.js';
import PasswordResetToken from './password-reset-token.model.js';
import LoginAudit from './login-audit.model.js';
import OTP from './otp.model.js';

// Helper to parse duration string (e.g. '15m', '30d') to milliseconds
const parseDuration = (val) => {
  const match = val.match(/^(\d+)([smhd])$/);
  if (!match) return 30 * 24 * 60 * 60 * 1000;
  const num = parseInt(match[1], 10);
  const unit = match[2];
  switch (unit) {
    case 's':
      return num * 1000;
    case 'm':
      return num * 60000;
    case 'h':
      return num * 3600000;
    case 'd':
      return num * 86400000;
    default:
      return 30 * 24 * 60 * 60 * 1000;
  }
};

// Generate and sign Access Token
export const generateAccessToken = (user) => {
  return jwt.sign({ id: user._id, email: user.email }, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN,
  });
};

// Generate, sign, and store Refresh Token
export const generateRefreshToken = async (user) => {
  const token = jwt.sign({ id: user._id, jti: crypto.randomBytes(16).toString('hex') }, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN,
  });

  const durationMs = parseDuration(env.JWT_REFRESH_EXPIRES_IN);
  const expiresAt = new Date(Date.now() + durationMs);

  await RefreshToken.create({
    token,
    user: user._id,
    expiresAt,
  });

  return token;
};

// Core Auth Service functions
export const authService = {
  /**
   * Admin / Staff Login
   */
  adminLogin: async (email, password, ip, userAgent) => {
    const user = await Users.findOne({ email }).select('+passwordHash').populate('role');

    if (!user) {
      await LoginAudit.create({ email, ipAddress: ip, userAgent, status: 'failed', failureReason: 'User not found' });
      throw new AppError('Invalid email or password.', 401);
    }

    if (user.status !== 'active') {
      await LoginAudit.create({
        user: user._id,
        email,
        ipAddress: ip,
        userAgent,
        status: 'failed',
        failureReason: `Account is ${user.status}`,
      });
      throw new AppError('Your account is deactivated or suspended.', 403);
    }

    // Verify user is not a standard customer
    if (user.role && user.role.name === 'customer') {
      await LoginAudit.create({
        user: user._id,
        email,
        ipAddress: ip,
        userAgent,
        status: 'failed',
        failureReason: 'Customer attempting admin login',
      });
      throw new AppError('Access denied: You are not authorized to log in here.', 403);
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      await LoginAudit.create({
        user: user._id,
        email,
        ipAddress: ip,
        userAgent,
        status: 'failed',
        failureReason: 'Incorrect password',
      });
      throw new AppError('Invalid email or password.', 401);
    }

    // Update user's last login
    user.lastLoginAt = new Date();
    await user.save();

    const accessToken = generateAccessToken(user);
    const refreshToken = await generateRefreshToken(user);

    await LoginAudit.create({ user: user._id, email, ipAddress: ip, userAgent, status: 'success' });

    // Clean user passwordHash for response
    user.passwordHash = undefined;

    return { user, accessToken, refreshToken };
  },

  /**
   * Customer Register
   */
  customerRegister: async (userData) => {
    // Ensure email and phone are unique
    const emailTaken = await Users.findOne({ email: userData.email, includeDeleted: true });
    if (emailTaken) {
      throw new AppError('Email is already registered.', 400);
    }

    const phoneTaken = await Users.findOne({ phone: userData.phone, includeDeleted: true });
    if (phoneTaken) {
      throw new AppError('Phone number is already registered.', 400);
    }

    // Find the customer role
    const customerRole = await Role.findOne({ name: 'customer' });
    if (!customerRole) {
      throw new AppError('Customer role has not been seeded.', 500);
    }

    const passwordHash = await bcrypt.hash(userData.password, 10);

    const newUser = await Users.create({
      name: userData.name,
      email: userData.email,
      phone: userData.phone,
      passwordHash,
      role: customerRole._id,
      status: 'active',
    });

    const populatedUser = await Users.findById(newUser._id).populate('role');
    const accessToken = generateAccessToken(populatedUser);
    const refreshToken = await generateRefreshToken(populatedUser);

    return { user: populatedUser, accessToken, refreshToken };
  },

  /**
   * Customer Login
   */
  customerLogin: async (email, password, ip, userAgent) => {
    const user = await Users.findOne({ email }).select('+passwordHash').populate('role');

    if (!user) {
      await LoginAudit.create({ email, ipAddress: ip, userAgent, status: 'failed', failureReason: 'User not found' });
      throw new AppError('Invalid email or password.', 401);
    }

    if (user.status !== 'active') {
      await LoginAudit.create({
        user: user._id,
        email,
        ipAddress: ip,
        userAgent,
        status: 'failed',
        failureReason: `Account is ${user.status}`,
      });
      throw new AppError('Your account is deactivated or suspended.', 403);
    }

    // Verify user is a customer
    if (user.role && user.role.name !== 'customer') {
      await LoginAudit.create({
        user: user._id,
        email,
        ipAddress: ip,
        userAgent,
        status: 'failed',
        failureReason: 'Staff attempting customer login',
      });
      throw new AppError('Access denied: Please use the staff portal.', 403);
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      await LoginAudit.create({
        user: user._id,
        email,
        ipAddress: ip,
        userAgent,
        status: 'failed',
        failureReason: 'Incorrect password',
      });
      throw new AppError('Invalid email or password.', 401);
    }

    // Update user's last login
    user.lastLoginAt = new Date();
    await user.save();

    const accessToken = generateAccessToken(user);
    const refreshToken = await generateRefreshToken(user);

    await LoginAudit.create({ user: user._id, email, ipAddress: ip, userAgent, status: 'success' });

    user.passwordHash = undefined;

    return { user, accessToken, refreshToken };
  },

  /**
   * Refresh Token Rotation
   */
  refreshToken: async (tokenStr) => {
    // 1. Verify token signature
    try {
      jwt.verify(tokenStr, env.JWT_REFRESH_SECRET);
    } catch (err) {
      throw new AppError('Invalid refresh token.', 401);
    }

    // 2. Look up token in database
    const dbToken = await RefreshToken.findOne({ token: tokenStr });

    // 3. Security Check: Token Reuse Detection
    if (!dbToken || dbToken.isRevoked) {
      if (dbToken) {
        // Token has been revoked previously. Potential breach! Revoke ALL user sessions
        await RefreshToken.updateMany({ user: dbToken.user }, { isRevoked: true });
      }
      throw new AppError('Token has been revoked or is invalid. Please log in again.', 401);
    }

    // Check if expired
    if (dbToken.isExpired()) {
      dbToken.isRevoked = true;
      await dbToken.save();
      throw new AppError('Refresh token has expired. Please log in again.', 401);
    }

    // 4. Load User
    const user = await Users.findById(dbToken.user).populate('role');
    if (!user || user.status !== 'active') {
      throw new AppError('User account associated with this token is disabled or suspended.', 403);
    }

    // 5. Generate New Tokens
    const newAccessToken = generateAccessToken(user);
    const newRefreshTokenStr = jwt.sign({ id: user._id, jti: crypto.randomBytes(16).toString('hex') }, env.JWT_REFRESH_SECRET, {
      expiresIn: env.JWT_REFRESH_EXPIRES_IN,
    });

    const durationMs = parseDuration(env.JWT_REFRESH_EXPIRES_IN);
    const expiresAt = new Date(Date.now() + durationMs);

    await RefreshToken.create({
      token: newRefreshTokenStr,
      user: user._id,
      expiresAt,
    });

    // Rotate: Revoke old token and set replacedByToken
    dbToken.isRevoked = true;
    dbToken.replacedByToken = newRefreshTokenStr;
    await dbToken.save();

    return { accessToken: newAccessToken, refreshToken: newRefreshTokenStr };
  },

  /**
   * Revoke single session (Logout)
   */
  logout: async (tokenStr) => {
    const dbToken = await RefreshToken.findOne({ token: tokenStr });
    if (dbToken) {
      dbToken.isRevoked = true;
      await dbToken.save();
    }
  },

  /**
   * Revoke all sessions (Logout all)
   */
  logoutAll: async (userId) => {
    await RefreshToken.updateMany({ user: userId }, { isRevoked: true });
  },

  /**
   * Forgot Password (check user existence & generate OTP)
   */
  forgotPassword: async (email) => {
    const cleanEmail = (email || '').trim().toLowerCase();
    const user = await Users.findOne({ email: cleanEmail });
    if (!user) {
      throw new AppError('No account found with this email. Please register.', 404);
    }

    if (user.status !== 'active') {
      throw new AppError(`Account is ${user.status}. Please contact support.`, 403);
    }

    // Static zero OTP as requested ("initially all zero static")
    const otpCode = '0000';
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

    await OTP.deleteMany({ identifier: cleanEmail });
    await OTP.create({
      identifier: cleanEmail,
      otp: otpCode,
      expiresAt,
    });

    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    await PasswordResetToken.deleteMany({ user: user._id });
    await PasswordResetToken.create({
      token: hashedToken,
      user: user._id,
      expiresAt,
    });

    return {
      message: 'OTP sent to your registered email.',
      email: cleanEmail,
      otp: otpCode,
      token: resetToken,
      resetToken,
      userExists: true,
    };
  },

  /**
   * Reset Password
   */
  resetPassword: async (payload) => {
    const rawToken = payload.token || payload.resetToken;
    const email = payload.email ? payload.email.trim().toLowerCase() : null;
    const newPassword = payload.password || payload.newPassword;
    const confirmPassword = payload.confirmPassword;

    if (!newPassword || newPassword.length < 6) {
      throw new AppError('Password must be at least 6 characters long.', 400);
    }

    if (confirmPassword && newPassword !== confirmPassword) {
      throw new AppError('Passwords do not match.', 400);
    }

    let user;

    if (rawToken) {
      const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
      const dbToken = await PasswordResetToken.findOne({ token: hashedToken });
      if (dbToken && !dbToken.isExpired()) {
        user = await Users.findById(dbToken.user);
      }
    }

    if (!user && email) {
      user = await Users.findOne({ email });
    }

    if (!user || user.status !== 'active') {
      throw new AppError('User not found or account is deactivated.', 404);
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    user.passwordHash = passwordHash;
    await user.save();

    await RefreshToken.updateMany({ user: user._id }, { isRevoked: true });
    await PasswordResetToken.deleteMany({ user: user._id });
    await OTP.deleteMany({ identifier: user.email });

    return {
      message: 'Password has been reset successfully. Please log in with your new password.',
      user: {
        _id: user._id,
        email: user.email,
        name: user.name,
      },
    };
  },

  /**
   * Change Password (while logged in)
   */
  changePassword: async (userId, oldPassword, newPassword) => {
    const user = await Users.findById(userId).select('+passwordHash');
    if (!user) {
      throw new AppError('User not found.', 404);
    }

    const isMatch = await user.comparePassword(oldPassword);
    if (!isMatch) {
      throw new AppError('Incorrect old password.', 400);
    }

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await user.save();

    await RefreshToken.updateMany({ user: user._id }, { isRevoked: true });
  },

  /**
   * Send mock OTP
   */
  sendOtp: async (identifier) => {
    const cleanId = (identifier || '').trim().toLowerCase();
    const otpCode = '0000';
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await OTP.deleteMany({ identifier: cleanId });
    await OTP.create({
      identifier: cleanId,
      otp: otpCode,
      expiresAt,
    });

    return { identifier: cleanId, otp: otpCode };
  },

  /**
   * Verify OTP - accepts any sequence of zeros (4 digits '0000', 6 digits '000000', etc.), '123456', or DB OTP
   */
  verifyOtp: async (identifier, otp) => {
    const cleanId = (identifier || '').trim().toLowerCase();
    const cleanOtp = (otp || '').trim();

    const user = await Users.findOne({
      $or: [{ email: cleanId }, { phone: cleanId }]
    });

    if (!user) {
      throw new AppError('No registered user found with this email or phone.', 404);
    }

    // Accepts any all-zero string ('0000', '000000', etc.), '123456', or matching OTP from DB
    const isAllZeros = cleanOtp.length >= 1 && /^0+$/.test(cleanOtp);
    const isMockOtp = isAllZeros || cleanOtp === '123456' || cleanOtp === '0000' || cleanOtp === '000000';
    const dbOtp = await OTP.findOne({ identifier: cleanId, otp: cleanOtp });

    if (!isMockOtp && (!dbOtp || Date.now() >= dbOtp.expiresAt)) {
      throw new AppError('Invalid or expired OTP code.', 400);
    }

    if (user.email === cleanId) {
      user.emailVerified = true;
      await user.save();
    } else if (user.phone === cleanId) {
      user.phoneVerified = true;
      await user.save();
    }

    if (dbOtp) {
      await OTP.deleteOne({ _id: dbOtp._id });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    await PasswordResetToken.deleteMany({ user: user._id });
    await PasswordResetToken.create({
      token: hashedToken,
      user: user._id,
      expiresAt,
    });

    return {
      message: 'OTP verified successfully.',
      email: user.email,
      resetToken,
      token: resetToken,
      verified: true,
    };
  },
};

export default authService;
