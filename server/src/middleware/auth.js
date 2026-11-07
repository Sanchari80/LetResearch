import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { User } from '../models/User.js';
import { forbidden, unauthorized } from '../utils/http.js';

export function signToken(userId) {
  return jwt.sign({ sub: String(userId) }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, config.jwtSecret);
  } catch {
    return null;
  }
}

function readToken(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7).trim();
  return null;
}

async function loadUser(req) {
  const token = readToken(req);
  if (!token) return null;
  const payload = verifyToken(token);
  if (!payload?.sub) return null;
  const user = await User.findById(payload.sub).select('name username email role settings').lean();
  return user || null;
}

export function isAdmin(user) {
  return !!user && (user.role === 'admin' || config.adminEmails.includes(String(user.email).toLowerCase()));
}

/** Rejects the request unless a valid token is present. Sets req.user and req.userId. */
export async function requireAuth(req, _res, next) {
  const user = await loadUser(req);
  if (!user) throw unauthorized();
  req.user = user;
  req.userId = String(user._id);
  next();
}

/** Attaches the user when a valid token is present, but also allows anonymous visitors. */
export async function optionalAuth(req, _res, next) {
  const user = await loadUser(req);
  if (user) {
    req.user = user;
    req.userId = String(user._id);
  }
  next();
}

export function requireAdmin(req, _res, next) {
  if (!isAdmin(req.user)) throw forbidden('Only moderators can do this.');
  next();
}
