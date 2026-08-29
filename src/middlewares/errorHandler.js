import env from '../config/env.js';
import AppError from '../errors/AppError.js';

export const errorHandler = (err, req, res, _next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  let error = { ...err };
  error.message = err.message;
  error.stack = err.stack;

  // Handle Mongoose Validation Error
  if (err.name === 'ValidationError') {
    const message = 'Validation failed';
    const errors = Object.values(err.errors).map((el) => ({
      field: el.path,
      message: el.message,
    }));
    error = new AppError(message, 400, errors);
  }

  // Handle Mongoose Duplicate Key Error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    const message = `Duplicate value for field: ${field}. Please use another value.`;
    error = new AppError(message, 400, [
      {
        field,
        message: `${field} must be unique`,
      },
    ]);
  }

  // Handle Mongoose CastError (e.g. invalid ObjectId)
  if (err.name === 'CastError') {
    const message = `Invalid ${err.path}: ${err.value}`;
    error = new AppError(message, 400);
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    error = new AppError('Invalid token. Please log in again.', 401);
  }
  if (err.name === 'TokenExpiredError') {
    error = new AppError('Your token has expired. Please log in again.', 401);
  }

  // Final Response Formatting
  const isDev = env.NODE_ENV === 'development';

  res.status(error.statusCode).json({
    success: false,
    message: error.message || 'An unexpected error occurred',
    errors: error.errors || [],
    ...(isDev && { stack: error.stack }),
  });
};

export default errorHandler;
