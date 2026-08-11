import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { connectDB } from './db.js';
import { seedMongoDB } from './seed.js';

import productsRouter from './routes/products.js';
import customersRouter from './routes/customers.js';
import quotationsRouter from './routes/quotations.js';
import settingsRouter from './routes/settings.js';
import emailRouter from './routes/email.js';
import authRouter from './routes/auth.js';
import usersRouter from './routes/users.js';
import uploadsRouter from './routes/uploads.js';
import { requireAuth } from './middleware/auth.js';

dotenv.config();

if (process.env.NODE_ENV === 'production' || process.env.VERCEL) {
  const requiredVariables = ['MONGODB_URI', 'JWT_SECRET', 'APP_URL', 'BREVO_API_KEY', 'CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'];
  const missingVariables = requiredVariables.filter(key => !process.env[key]);
  if (missingVariables.length) throw new Error(`Missing required production environment variables: ${missingVariables.join(', ')}`);
  if (process.env.JWT_SECRET.length < 32) throw new Error('JWT_SECRET must contain at least 32 characters');
}

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
const allowedOrigins = (process.env.APP_URL || 'http://localhost:3000,http://localhost:5173')
  .split(',')
  .map(origin => origin.trim().replace(/\/$/, ''));
app.use(cors({
  credentials: true,
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin.replace(/\/$/, ''))) return callback(null, true);
    return callback(Object.assign(new Error('Origin is not allowed by CORS'), { status: 403 }));
  },
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());

// Ensure DB is connected before processing API requests (Essential for Vercel Serverless)
let initializationPromise;
app.use('/api', async (_req, res, next) => {
  try {
    initializationPromise ||= connectDB().then(seedMongoDB);
    await initializationPromise;
    next();
  } catch (error) {
    initializationPromise = null;
    console.error('Database connection middleware error:', error);
    res.status(500).json({ error: 'Database connection error: ' + error.message });
  }
});

// Public API routes
app.get('/api/health', (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
app.use('/api/auth', authRouter);
app.use('/api/uploads', uploadsRouter);

// All business data requires an approved, active account.
app.use('/api', requireAuth);
app.use('/api/products', productsRouter);
app.use('/api/customers', customersRouter);
app.use('/api/quotations', quotationsRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/email', emailRouter);
app.use('/api/users', usersRouter);

app.use('/api', (_req, res) => res.status(404).json({ error: 'API endpoint not found' }));
app.use((error, _req, res, _next) => {
  console.error(error);
  if (error?.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'Image must be 5MB or smaller' });
  res.status(error?.status || 500).json({ error: process.env.NODE_ENV === 'production' ? 'Unexpected server error' : error.message });
});

// Start Server in local dev environment
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`🚀 Express API Server running on http://localhost:${PORT}`);
  });
}

export default app;
