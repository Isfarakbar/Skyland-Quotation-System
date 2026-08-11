import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB } from './db.js';
import { seedMongoDB } from './seed.js';

import productsRouter from './routes/products.js';
import customersRouter from './routes/customers.js';
import quotationsRouter from './routes/quotations.js';
import settingsRouter from './routes/settings.js';
import emailRouter from './routes/email.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// API Routes
app.use('/api/products', productsRouter);
app.use('/api/customers', customersRouter);
app.use('/api/quotations', quotationsRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/email', emailRouter);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Skyland Quotation System API Server Running',
    timestamp: new Date().toISOString(),
  });
});

// Start Server & Connect MongoDB
async function startServer() {
  try {
    await connectDB();
    await seedMongoDB();
    if (process.env.NODE_ENV !== 'production') {
      app.listen(PORT, () => {
        console.log(`🚀 Express API Server running on http://localhost:${PORT}`);
      });
    }
  } catch (error) {
    console.error('Failed to start server:', error);
  }
}

startServer();

export default app;
