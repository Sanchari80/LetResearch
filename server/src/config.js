// Central configuration for the LetResearch API.
// Values come from environment variables (Render dashboard, render.yaml, or a local .env file).

try {
  // Node 20.12+ can load a .env file without extra dependencies.
  process.loadEnvFile?.();
} catch {
  // No .env file found – that's fine in production.
}

const env = process.env;
const isProduction = env.NODE_ENV === 'production';

function list(value) {
  return (value || '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

let jwtSecret = env.JWT_SECRET;
if (!jwtSecret) {
  if (isProduction) {
    throw new Error('JWT_SECRET is required in production. Set it in your Render environment.');
  }
  jwtSecret = 'letresearch-dev-secret-change-me';
  console.warn('[config] JWT_SECRET is not set. Using an insecure development secret.');
}

export const config = {
  appName: 'LetResearch',
  publisher: 'SKT Software Land',
  version: '1.0.0',
  isProduction,
  port: Number(env.PORT) || 4000,
  mongoUri: env.MONGODB_URI || 'mongodb://127.0.0.1:27017/letresearch',
  jwtSecret,
  jwtExpiresIn: env.JWT_EXPIRES_IN || '30d',
  fileUrlSecret: env.FILE_URL_SECRET || jwtSecret,
  // Comma separated list of allowed web origins, or "*" to allow any origin.
  corsOrigins: list(env.CORS_ORIGIN).length ? list(env.CORS_ORIGIN) : ['*'],
  adminEmails: list(env.ADMIN_EMAILS).map((e) => e.toLowerCase()),
  reportThreshold: Number(env.REPORT_THRESHOLD) || 3,
  moderation: {
    // Optional AI image + text review. Leave empty to use the built-in rule engine only.
    anthropicApiKey: env.ANTHROPIC_API_KEY || '',
    anthropicModel: env.ANTHROPIC_MODEL || 'claude-haiku-5-5',
  },
  // Web push (notifications while the app is closed). Without keys, the server creates a key
  // pair once and keeps it in the database, so nothing needs to be configured.
  push: {
    publicKey: env.VAPID_PUBLIC_KEY || '',
    privateKey: env.VAPID_PRIVATE_KEY || '',
    subject: env.VAPID_SUBJECT || '',
  },
  limits: {
    paperBytes: (Number(env.MAX_PAPER_MB) || 20) * 1024 * 1024,
    imageBytes: (Number(env.MAX_IMAGE_MB) || 8) * 1024 * 1024,
    videoBytes: (Number(env.MAX_VIDEO_MB) || 40) * 1024 * 1024,
    chatFileBytes: (Number(env.MAX_CHAT_FILE_MB) || 15) * 1024 * 1024,
  },
};
