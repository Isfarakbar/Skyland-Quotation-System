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
import auditRouter from './routes/audit.js';
import templatesRouter from './routes/templates.js';
import { AUTH_COOKIE, requireAuth, requireCsrf } from './middleware/auth.js';
import { requestId, safeMessage } from './lib/api.js';

dotenv.config();

if (process.env.NODE_ENV === 'production' || process.env.VERCEL) {
  // Only core authentication/database settings should prevent the API from
  // starting. Email and image integrations already return feature-specific
  // errors when they are not configured, and Vercel supplies deployment URLs.
  const requiredVariables = ['MONGODB_URI'];
  const missingVariables = requiredVariables.filter(key => !process.env[key]);
  if (missingVariables.length) throw new Error(`Missing required production environment variables: ${missingVariables.join(', ')}`);
}

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
const normalizeOrigin = value => {
  const origin = String(value || '').trim();
  if (!origin) return '';
  return (origin.startsWith('http://') || origin.startsWith('https://') ? origin : `https://${origin}`).replace(/\/$/, '');
};
const allowedOrigins = new Set([
  ...(process.env.APP_URL || 'http://localhost:3000,http://localhost:5173').split(','),
  process.env.VERCEL_PROJECT_PRODUCTION_URL,
  process.env.VERCEL_URL,
].map(normalizeOrigin).filter(Boolean));
app.use(cors({
  credentials: true,
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(normalizeOrigin(origin))) return callback(null, true);
    return callback(Object.assign(new Error('Origin is not allowed by CORS'), { status: 403 }));
  },
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());
app.use('/api', (req, res, next) => {
  req.id = req.get('x-request-id') || requestId();
  res.set('X-Request-Id', req.id);
  res.set('Cache-Control', 'private, no-store');
  next();
});
app.use('/api', requireCsrf);

// Keep the platform health check independent from MongoDB so a Vercel probe
// does not wake the database or wait for bootstrap work.
app.get('/api/health', (_req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Ensure DB is connected before processing API requests (Essential for Vercel Serverless)
let initializationPromise;
app.use('/api', async (req, res, next) => {
  // A signed-out browser checks /auth/me during startup. It can be rejected
  // from the missing cookie immediately instead of paying for a MongoDB cold
  // connection before the login screen appears.
  const hasBearerToken = req.get('authorization')?.startsWith('Bearer ');
  if (req.path === '/auth/me' && !req.cookies?.[AUTH_COOKIE] && !hasBearerToken) return next();
  try {
    initializationPromise ||= connectDB().then(() => (
      process.env.NODE_ENV === 'test' || process.env.BOOTSTRAP_ON_START === '1' ? seedMongoDB() : undefined
    ));
    await initializationPromise;
    next();
  } catch (error) {
    initializationPromise = null;
    console.error('Database connection middleware error:', error);
    res.status(503).json({ error: { code: 'DATABASE_UNAVAILABLE', message: 'The data service is temporarily unavailable', requestId: req.id } });
  }
});

// Public API routes
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
app.use('/api/audit', auditRouter);
app.use('/api/templates', templatesRouter);

app.use('/api', (req, res) => res.status(404).json({ error: { code: 'NOT_FOUND', message: 'API endpoint not found', requestId: req.id } }));
app.use((error, req, res, _next) => {
  if (error?.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: { code: 'UPLOAD_TOO_LARGE', message: 'Image must be 5MB or smaller', requestId: req.id } });
  const status = error?.status || (error?.code === 11000 ? 409 : ['CastError', 'ValidationError'].includes(error?.name) ? 400 : 500);
  if (status >= 500) console.error(error);
  const message = process.env.NODE_ENV === 'production' ? safeMessage(error) : (error.message || safeMessage(error));
  const code = error?.code === 11000 ? 'CONFLICT' : typeof error?.code === 'string' ? error.code : (status >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_INVALID');
  res.status(status).json({ error: { code, message, ...(error?.fields ? { fields: error.fields } : {}), requestId: req.id } });
});

// Start Server in local dev environment
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL && process.env.SKYLAND_FIXTURE !== '1') {
  app.listen(PORT, () => {
    console.log(`🚀 Express API Server running on http://localhost:${PORT}`);
  });
}

export default app;
