import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { config } from '../config.js';
import { isAdmin, requireAuth, signToken } from '../middleware/auth.js';
import { User } from '../models/User.js';
import { getCounts } from '../services/notify.js';
import { profileForViewer } from '../services/serializers.js';
import { badRequest, cleanText, conflict, unauthorized } from '../utils/http.js';
import { generateUsername } from '../utils/username.js';

const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: { message: 'Too many attempts. Please wait a few minutes and try again.', code: 'RATE_LIMITED' } },
});

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function validatePassword(password) {
  if (typeof password !== 'string' || password.length < 8) {
    throw badRequest('Use a password with at least 8 characters.', 'WEAK_PASSWORD');
  }
  if (password.length > 128) throw badRequest('Password is too long.', 'WEAK_PASSWORD');
}

async function sessionPayload(user) {
  return {
    token: signToken(user._id),
    user: profileForViewer(user, 'self'),
    isAdmin: isAdmin(user),
  };
}

router.post('/register', authLimiter, async (req, res) => {
  const name = cleanText(req.body?.name, 80);
  const email = cleanText(req.body?.email, 160).toLowerCase();
  const password = req.body?.password;
  if (name.length < 2) throw badRequest('Enter your full name.', 'INVALID_NAME');
  if (!EMAIL_PATTERN.test(email)) throw badRequest('Enter a valid email address.', 'INVALID_EMAIL');
  validatePassword(password);
  if (await User.exists({ email })) throw conflict('An account with this email already exists. Sign in instead.', 'EMAIL_TAKEN');

  const user = await User.create({
    name,
    email,
    username: await generateUsername(name),
    passwordHash: await bcrypt.hash(password, 10),
    headline: cleanText(req.body?.headline, 140),
    links: { email },
    role: config.adminEmails.includes(email) ? 'admin' : 'user',
  });
  res.status(201).json(await sessionPayload(user.toObject()));
});

router.post('/login', authLimiter, async (req, res) => {
  const email = cleanText(req.body?.email, 160).toLowerCase();
  const password = String(req.body?.password || '');
  const user = await User.findOne({ email }).select('+passwordHash').lean();
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    throw unauthorized('Email or password is incorrect.');
  }
  delete user.passwordHash;
  res.json(await sessionPayload(user));
});

router.get('/me', requireAuth, async (req, res) => {
  const user = await User.findById(req.userId).lean();
  if (!user) throw unauthorized();
  res.json({ user: profileForViewer(user, 'self'), isAdmin: isAdmin(user), counts: await getCounts(req.userId) });
});

router.post('/change-password', requireAuth, async (req, res) => {
  const user = await User.findById(req.userId).select('+passwordHash');
  if (!(await bcrypt.compare(String(req.body?.currentPassword || ''), user.passwordHash))) {
    throw badRequest('Your current password is incorrect.', 'WRONG_PASSWORD');
  }
  validatePassword(req.body?.newPassword);
  user.passwordHash = await bcrypt.hash(req.body.newPassword, 10);
  await user.save();
  res.json({ ok: true });
});

export default router;
