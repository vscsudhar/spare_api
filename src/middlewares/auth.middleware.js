import jwt from 'jsonwebtoken';
import env from '../config/env.js';
import AppError from '../errors/AppError.js';
import catchAsync from '../utils/catchAsync.js';
import Users from '../modules/users/users.model.js';

export const protect = catchAsync(async (req, res, next) => {
  // Allow preflight OPTIONS requests
  if (req.method === 'OPTIONS') return next();
  // 1. Get access token from header
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return next(new AppError('You are not logged in. Please log in to get access.', 401));
  }

  // 2. Verify token
  let decoded;
  try {
    decoded = jwt.verify(token, env.JWT_ACCESS_SECRET);
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return next(new AppError('Your token has expired. Please log in again.', 401));
    }
    return next(new AppError('Invalid token. Please log in again.', 401));
  }

  // 3. Check if user still exists & is active
  const user = await Users.findById(decoded.id)
    .populate({
      path: 'role',
      populate: {
        path: 'permissions',
        model: 'Permission',
      },
    })
    .populate('permissions');

  if (!user) {
    return next(new AppError('The user belonging to this token no longer exists.', 401));
  }

  if (user.status !== 'active') {
    return next(new AppError('Your account has been deactivated or suspended. Please contact support.', 403));
  }

  // 4. Flatten permissions for easy checking in authorization middleware
  const permissionNames = new Set();
  
  // Add role permissions
  if (user.role && user.role.permissions) {
    user.role.permissions.forEach((p) => {
      if (p && p.name) permissionNames.add(p.name);
    });
  }

  // Add individual permission overrides
  if (user.permissions) {
    user.permissions.forEach((p) => {
      if (p && p.name) permissionNames.add(p.name);
    });
  }

  // Check if owner role (owner gets all permissions implicitly)
  const isOwner = user.role && user.role.name === 'owner';

  // 5. Attach user and permissions to request
  req.user = user;
  req.permissions = Array.from(permissionNames);
  req.isOwner = isOwner;

  next();
});

export const optionalProtect = catchAsync(async (req, res, next) => {
  if (req.method === 'OPTIONS') return next();

  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    req.user = null;
    return next();
  }

  try {
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET);
    const user = await Users.findById(decoded.id);
    if (user && user.status === 'active') {
      req.user = user;
    } else {
      req.user = null;
    }
  } catch (_) {
    req.user = null;
  }

  next();
});

export default protect;
