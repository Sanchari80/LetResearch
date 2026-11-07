// Real-time layer: live chat delivery, typing status, online presence, read receipts and
// in-app notifications. Every signed-in device joins a private room named "user:<id>".
import { Server } from 'socket.io';
import { config } from '../config.js';
import { isValidId } from '../db.js';
import { verifyToken } from '../middleware/auth.js';
import { Connection, Conversation, User } from '../models/index.js';

let io = null;
/** userId -> Set of socket ids (a user can be online on several devices). */
const onlineSockets = new Map();

const room = (userId) => `user:${userId}`;

/** Sockets whose page is in the background (another tab, a minimised window, a phone app switched away). */
const hiddenSockets = new Set();

export function isOnline(userId) {
  return onlineSockets.has(String(userId));
}

/**
 * True when the user has LetResearch on screen on at least one device. Phone notifications
 * (web push) are sent whenever this is false, even if a background tab is still connected.
 */
export function isOnScreen(userId) {
  const sockets = onlineSockets.get(String(userId));
  if (!sockets) return false;
  for (const id of sockets) if (!hiddenSockets.has(id)) return true;
  return false;
}

export function emitToUser(userId, event, payload) {
  if (!io || !userId) return;
  io.to(room(String(userId))).emit(event, payload);
}

export function emitToUsers(userIds, event, payload) {
  for (const id of new Set(userIds.map(String))) emitToUser(id, event, payload);
}

/** People who should see this user's online status: chat partners and connections. */
async function presenceAudience(userId) {
  const [conversations, connections] = await Promise.all([
    Conversation.find({ participants: userId, status: 'active' }).select('participants').lean(),
    Connection.find({ status: 'accepted', $or: [{ requester: userId }, { recipient: userId }] })
      .select('requester recipient')
      .lean(),
  ]);
  const ids = new Set();
  for (const c of conversations) for (const p of c.participants) ids.add(String(p));
  for (const c of connections) {
    ids.add(String(c.requester));
    ids.add(String(c.recipient));
  }
  ids.delete(String(userId));
  return [...ids];
}

async function broadcastPresence(userId, online, lastSeenAt) {
  try {
    const audience = await presenceAudience(userId);
    emitToUsers(audience, 'presence', { userId: String(userId), online, lastSeenAt });
  } catch (error) {
    console.error('[socket] presence broadcast failed', error.message);
  }
}

export function initSocket(httpServer) {
  const allowAll = config.corsOrigins.includes('*');
  io = new Server(httpServer, {
    cors: { origin: allowAll ? true : config.corsOrigins, credentials: false },
    pingInterval: 20000,
    pingTimeout: 20000,
    maxHttpBufferSize: 1e6,
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    const payload = token ? verifyToken(String(token)) : null;
    if (!payload?.sub) return next(new Error('UNAUTHORIZED'));
    socket.data.userId = String(payload.sub);
    next();
  });

  io.on('connection', (socket) => {
    const userId = socket.data.userId;
    socket.join(room(userId));

    if (socket.handshake.auth?.visible === false) hiddenSockets.add(socket.id);
    // The app reports when it goes to the background and comes back.
    socket.on('visibility', (payload = {}) => {
      if (payload.visible === false) hiddenSockets.add(socket.id);
      else hiddenSockets.delete(socket.id);
    });

    const sockets = onlineSockets.get(userId) || new Set();
    const cameOnline = sockets.size === 0;
    sockets.add(socket.id);
    onlineSockets.set(userId, sockets);
    if (cameOnline) broadcastPresence(userId, true, new Date());

    // Typing indicator – only relayed inside active (accepted) conversations.
    socket.on('typing', async (payload = {}) => {
      try {
        const { conversationId, isTyping } = payload;
        if (!isValidId(String(conversationId))) return;
        const conversation = await Conversation.findOne({
          _id: conversationId,
          participants: userId,
          status: 'active',
        })
          .select('participants')
          .lean();
        if (!conversation) return;
        const other = conversation.participants.map(String).find((p) => p !== userId);
        emitToUser(other, 'typing', { conversationId: String(conversationId), userId, isTyping: !!isTyping });
      } catch {
        // Ignore malformed typing events.
      }
    });

    // Ask which of these users are online right now.
    socket.on('presence:query', (ids, ack) => {
      if (typeof ack !== 'function' || !Array.isArray(ids)) return;
      const result = {};
      for (const id of ids.slice(0, 200)) result[String(id)] = isOnline(id);
      ack(result);
    });

    socket.on('disconnect', async () => {
      hiddenSockets.delete(socket.id);
      const set = onlineSockets.get(userId);
      if (!set) return;
      set.delete(socket.id);
      if (set.size > 0) return;
      onlineSockets.delete(userId);
      const lastSeenAt = new Date();
      try {
        await User.updateOne({ _id: userId }, { $set: { lastSeenAt } });
      } catch {
        // The database may be shutting down – presence is best effort.
      }
      broadcastPresence(userId, false, lastSeenAt);
    });
  });

  return io;
}
