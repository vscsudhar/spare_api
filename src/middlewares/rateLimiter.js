import rateLimit from 'express-rate-limit';

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes window
  max: process.env.NODE_ENV === 'test' ? 1000 : 5, // Limit each IP to 5 authentication attempts per windowMs (high limit in tests)
  message: {
    success: false,
    message: 'Too many authentication attempts from this IP. Please try again after 15 minutes.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export default loginLimiter;
