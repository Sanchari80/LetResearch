import compression from 'compression';
import cors from 'cors';
import express from 'express';
import { rateLimit } from 'express-rate-limit';
import helmet from 'helmet';
import mongoose from 'mongoose';
import morgan from 'morgan';
import { config } from './config.js';
import { errorHandler, notFoundHandler } from './middleware/errors.js';
import authRoutes from './routes/auth.js';
import connectionRoutes from './routes/connections.js';
import conversationRoutes from './routes/conversations.js';
import fileRoutes from './routes/files.js';
import moderationRoutes from './routes/moderation.js';
import notificationRoutes from './routes/notifications.js';
import paperRoutes from './routes/papers.js';
import postRoutes from './routes/posts.js';
import pushRoutes from './routes/push.js';
import userRoutes from './routes/users.js';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  // Files are loaded cross-origin by the web app (Vercel) from the API (Render).
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' }, contentSecurityPolicy: false }));
  const allowAll = config.corsOrigins.includes('*');
  app.use(
    cors({
      origin: allowAll ? true : config.corsOrigins,
      maxAge: 86400,
      exposedHeaders: ['Content-Disposition', 'Content-Range', 'Accept-Ranges', 'Content-Length'],
    }),
  );
  // Streamed media must not be compressed, or byte-range requests break.
  app.use(compression({ filter: (req, res) => !req.path.startsWith('/api/files/') && compression.filter(req, res) }));
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false, limit: '1mb' }));
  app.use(morgan(config.isProduction ? 'combined' : 'dev', { skip: (req) => req.path === '/api/health' }));
  app.use(
    '/api',
    rateLimit({
      windowMs: 60 * 1000,
      limit: 900,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
      message: { error: { message: 'Too many requests. Slow down for a moment.', code: 'RATE_LIMITED' } },
    }),
  );

  app.get('/', (_req, res) => {
    res.json({ name: 'LetResearch API', publisher: config.publisher, status: 'ok', health: '/api/health' });
  });

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      name: config.appName,
      publisher: config.publisher,
      version: config.version,
      database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
      aiModeration: !!config.moderation.anthropicApiKey,
      time: new Date().toISOString(),
    });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/papers', paperRoutes);
  app.use('/api/connections', connectionRoutes);
  app.use('/api/conversations', conversationRoutes);
  app.use('/api/posts', postRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/moderation', moderationRoutes);
  app.use('/api/files', fileRoutes);
  app.use('/api/push', pushRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
