import mongoose from 'mongoose';
import { config } from './config.js';

let bucket = null;

export async function connectDatabase() {
  mongoose.set('strictQuery', true);
  await mongoose.connect(config.mongoUri, {
    serverSelectionTimeoutMS: 15000,
    maxPoolSize: 20,
  });
  bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'uploads' });
  console.log(`[db] Connected to MongoDB (${mongoose.connection.name})`);
  return mongoose.connection;
}

/** GridFS bucket that stores every uploaded file (papers, images, videos, chat files). */
export function getBucket() {
  if (!bucket) throw new Error('Database is not connected yet.');
  return bucket;
}

export function isValidId(value) {
  return typeof value === 'string' && mongoose.isValidObjectId(value) && /^[a-f\d]{24}$/i.test(value);
}

export function toObjectId(value) {
  return new mongoose.Types.ObjectId(String(value));
}
