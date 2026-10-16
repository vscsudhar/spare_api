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

// Helper to determine allowed origins for CORS
const isOriginAllowed = (origin) => {
  if (!origin) return true;

  // Allow local and LAN development origins (Flutter Web / Dev servers)
  if (
    origin === 'http://localhost' ||
    origin.startsWith('http://localhost:') ||
    origin === 'https://localhost' ||
    origin.startsWith('https://localhost:') ||
    origin === 'http://127.0.0.1' ||
    origin.startsWith('http://127.0.0.1:') ||
    origin === 'https://127.0.0.1' ||
    origin.startsWith('https://127.0.0.1:') ||
    origin.startsWith('http://192.168.') ||
    origin.startsWith('https://192.168.') ||
    origin.startsWith('http://10.') ||
    origin.startsWith('https://10.') ||
    origin.startsWith('http://172.') ||
    origin.startsWith('https://172.')
  ) {
    return true;
  }

  if (env.CLIENT_URL && origin === env.CLIENT_URL) return true;
  if (env.FLUTTER_WEB_URL && origin === env.FLUTTER_WEB_URL) return true;

  return false;
};

// 1. Enable Private Network Access (PNA) for browsers communicating with LAN IP from localhost
app.use((req, res, next) => {
  if (req.headers['access-control-request-private-network']) {
    res.setHeader('Access-Control-Allow-Private-Network', 'true');
  }
  next();
});

const corsOptions = {
  origin: (origin, callback) => {
    if (isOriginAllowed(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS blocked origin: ${origin}`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'Accept',
    'X-Requested-With',
    'Origin',
    'Access-Control-Request-Method',
    'Access-Control-Request-Headers',
    'Access-Control-Request-Private-Network',
  ],
  exposedHeaders: ['Content-Range', 'X-Content-Range', 'RateLimit-Limit', 'RateLimit-Remaining'],
  optionsSuccessStatus: 200,
};

// 2. Enable CORS BEFORE any routes, helmet or body parsing
app.use(cors(corsOptions));
app.options('*', (req, res, next) => {
  if (req.headers['access-control-request-private-network']) {
    res.setHeader('Access-Control-Allow-Private-Network', 'true');
  }
  cors(corsOptions)(req, res, next);
});

// 2. Set security HTTP headers with cross-origin resource policy allowed
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    crossOriginEmbedderPolicy: false,
  })
);

// 3. Compress responses
app.use(compression());

// 4. Request logging
if (env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// 5. Body parsing (reading data from body into req.body)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 6. Data sanitization against NoSQL query injection
app.use(mongoSanitize());

// 7. Rate Limiting (Skip preflight OPTIONS requests)
const limiter = rateLimit({
  max: 100000,
  windowMs: 15 * 60 * 1000,
  skip: (req) => req.method === 'OPTIONS',
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again after 15 minutes.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', limiter);

// 8. Register routes
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'VoltSpare API is running and reachable',
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV,
  });
});

app.use(env.API_PREFIX, baseRoutes);

// 9. Fallback for unhandled endpoints
app.use(notFound);

// 10. Global Error Handler
app.use(errorHandler);

export default app;
