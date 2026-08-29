import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import morgan from 'morgan';
import mongoSanitize from 'express-mongo-sanitize';
import rateLimit from 'express-rate-limit';

import env from './config/env.js';
import path from 'path';
import baseRoutes from './routes/index.js';
import notFound from './middlewares/notFound.js';
import errorHandler from './middlewares/errorHandler.js';

const app = express();

// Set security HTTP headers
app.use(helmet());

// Enable CORS
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      const isAllowed = [env.CLIENT_URL, env.FLUTTER_WEB_URL].indexOf(origin) !== -1 ||
                        origin.startsWith('http://localhost:') ||
                        origin.startsWith('http://127.0.0.1:') ||
                        origin.startsWith('http://192.168.');
      if (isAllowed) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With'],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  })
);

// Compress responses
app.use(compression());

// Request logging
if (env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Body parsing (reading data from body into req.body)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Data sanitization against NoSQL query injection
app.use(mongoSanitize());

// Limit requests from same API
const limiter = rateLimit({
  max: 100, // Limit each IP to 100 requests per windowMs
  windowMs: 15 * 60 * 1000, // 15 minutes
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again after 15 minutes.',
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});
app.use('/api', limiter);

// Register routes
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));
app.use(env.API_PREFIX, baseRoutes);

// Fallback for unhandled endpoints
app.use(notFound);

// Global Error Handler
app.use(errorHandler);

export default app;


