import mongoose from 'mongoose';

let connectionPromise;

export async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is not defined in environment variables');
  }

  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  if (connectionPromise) return connectionPromise;

  try {
    connectionPromise = mongoose.connect(uri, {
      dbName: 'skyland',
      maxPoolSize: 10,
      minPoolSize: 0,
      serverSelectionTimeoutMS: 8000,
    });
    const conn = await connectionPromise;
    connectionPromise = null;
    console.log(`⚡ MongoDB Connected: ${conn.connection.host}`);
    return conn.connection;
  } catch (error) {
    connectionPromise = null;
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    throw error;
  }
}
