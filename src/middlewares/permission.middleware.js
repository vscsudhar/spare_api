import AppError from '../errors/AppError.js';

/**
 * Restricts access to users who possess all of the required permissions.
 * Owner role bypasses all permission checks automatically.
 * @param {...string} requiredPermissions The permission keys required to access the endpoint.
 */
export const restrictTo = (...requiredPermissions) => {
  return (req, res, next) => {
    // 1. Ensure user is authenticated
    if (!req.user) {
      return next(new AppError('Authentication required.', 401));
    }

    // 2. Owner bypass
    if (req.isOwner) {
      return next();
    }

    // 3. Verify all required permissions are met
    const hasPermission = requiredPermissions.every((perm) => req.permissions.includes(perm));

    if (!hasPermission) {
      return next(new AppError('Forbidden: You do not have permission to perform this action.', 403));
    }

    next();
  };
};

export default restrictTo;
