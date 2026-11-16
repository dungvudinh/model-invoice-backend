// configs/mongoose.js
import mongoose from 'mongoose';
import { env } from './environment.js';

let isConnected = false;

const CONNECT_DB = async () => {
  try {
    if (isConnected) {
      console.log('✅ MongoDB already connected');
      return;
    }

    await mongoose.connect(env.MONGODB_URI, {
      dbName: env.DATABASE_NAME,
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
      bufferCommands: false,
    });
    
    isConnected = true;
    console.log('✅ MongoDB connected via Mongoose');
    
    // Event listeners để theo dõi trạng thái kết nối
    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err);
      isConnected = false;
    });

    mongoose.connection.on('disconnected', () => {
      console.log('⚠️ MongoDB disconnected');
      isConnected = false;
    });

    mongoose.connection.on('connected', () => {
      console.log('✅ MongoDB reconnected');
      isConnected = true;
    });

  } catch (error) {
    console.error('❌ Mongoose connection error:', error);
    process.exit(1);
  }
};

const CLOSE_DB = async () => {
  try {
    if (mongoose.connection.readyState !== 0) { // 0 = disconnected
      await mongoose.connection.close();
      console.log('📀 MongoDB connection closed gracefully');
      isConnected = false;
    }
  } catch (error) {
    console.error('❌ Error closing MongoDB connection:', error);
    throw error;
  }
};

export { CONNECT_DB, CLOSE_DB };
