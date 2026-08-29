import mongoose from 'mongoose';
import env from './env.js';

export const connectDB = async () => {
  try {
    const conn = await mongoose.connect(env.MONGODB_URI, {
      autoIndex: true,
    });
    console.log(`📡 MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    process.exit(1);
  }
};

// Monitor connection events
mongoose.connection.on('connected', () => {
  console.log('⚡ Mongoose connected to DB Cluster');
});

mongoose.connection.on('error', (err) => {
  console.error(`⚠️ Mongoose connection error: ${err}`);
});

mongoose.connection.on('disconnected', () => {
  console.log('🔌 Mongoose disconnected from DB Cluster');
});

export const closeDB = async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
    console.log('🔒 MongoDB connection closed gracefully');
  }
};

export default connectDB;
