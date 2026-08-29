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
   * Forgot Password (generate reset token)
   */
  forgotPassword: async (email) => {
    const user = await Users.findOne({ email });
    if (!user) {
      // Return dummy token or resolve to prevent email enumeration, but we return a token in data for development mocking
      return { message: 'If email exists, a reset token has been generated.' };
    }

    // Generate random reset token
    const resetToken = crypto.randomBytes(32).toString('hex');

    // Hash it for DB storage
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour expiry

    // Delete existing reset tokens for the user
    await PasswordResetToken.deleteMany({ user: user._id });

    // Store in DB
    await PasswordResetToken.create({
      token: hashedToken,
      user: user._id,
      expiresAt,
    });

    // In a production app, email this token. Here we return it in response for API usability
    return {
      message: 'If email exists, a reset token has been generated.',
      token: resetToken, // This raw token is what the client must send back
    };
  },

  /**
   * Reset Password
   */
  resetPassword: async (rawToken, newPassword) => {
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

    const dbToken = await PasswordResetToken.findOne({ token: hashedToken });
    if (!dbToken || dbToken.isExpired()) {
      throw new AppError('Password reset token is invalid or has expired.', 400);
    }

    const user = await Users.findById(dbToken.user);
    if (!user || user.status !== 'active') {
      throw new AppError('User not found or disabled.', 400);
    }

    // Hash password and save
    const passwordHash = await bcrypt.hash(newPassword, 10);
    user.passwordHash = passwordHash;
    await user.save();

    // Revoke all existing sessions on password change
    await RefreshToken.updateMany({ user: user._id }, { isRevoked: true });

    // Delete the reset token
    await PasswordResetToken.deleteOne({ _id: dbToken._id });
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

    // Revoke other active sessions
    await RefreshToken.updateMany({ user: user._id }, { isRevoked: true });
  },

  /**
   * Send mock OTP (Generates 123456 or a safe random OTP)
   */
  sendOtp: async (identifier) => {
    // Generate a fixed or random code. For easy development testing, let's generate '123456'
    const otpCode = '123456';
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Delete old OTPs for this identifier
    await OTP.deleteMany({ identifier });

    await OTP.create({
      identifier,
      otp: otpCode,
      expiresAt,
    });

    return { identifier, otp: otpCode };
  },

  /**
   * Verify OTP and flag user verification
   */
  verifyOtp: async (identifier, otp) => {
    const dbOtp = await OTP.findOne({ identifier, otp });
    if (!dbOtp || Date.now() >= dbOtp.expiresAt) {
      throw new AppError('Invalid or expired OTP.', 400);
    }

    // Try finding the user with email or phone matching the identifier
    const emailUser = await Users.findOne({ email: identifier.toLowerCase() });
    const phoneUser = await Users.findOne({ phone: identifier });

    if (emailUser) {
      emailUser.emailVerified = true;
      await emailUser.save();
    } else if (phoneUser) {
      phoneUser.phoneVerified = true;
      await phoneUser.save();
    } else {
      throw new AppError('No registered user found with this email/phone.', 404);
    }

    // Clean up used OTP
    await OTP.deleteOne({ _id: dbOtp._id });
  },
};

export default authService;
