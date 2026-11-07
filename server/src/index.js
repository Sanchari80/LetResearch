import http from 'node:http';
import mongoose from 'mongoose';
import { createApp } from './app.js';
import { config } from './config.js';
import { connectDatabase } from './db.js';
import { initSocket } from './realtime/socket.js';
import { initPush } from './services/push.js';

async function start() {
  try {
    await connectDatabase();
  } catch (error) {
    console.error('[startup] Could not connect to MongoDB. Check MONGODB_URI.', error.message);
    process.exit(1);
  }

  // Prepare web push keys in the background (created on first start when not configured).
  initPush().then((keys) => keys && console.log('[startup] Web push notifications are ready'));

  const app = createApp();
  const server = http.createServer(app);
  initSocket(server);

  server.listen(config.port, () => {
    console.log(`[startup] ${config.appName} API (${config.publisher}) listening on port ${config.port}`);
  });

  const shutdown = (signal) => {
    console.log(`[shutdown] ${signal} received, closing server…`);
    server.close(() => {
      mongoose.connection.close(false).finally(() => process.exit(0));
    });
    setTimeout(() => process.exit(0), 8000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

start();
