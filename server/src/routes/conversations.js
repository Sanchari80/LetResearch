import { Router } from 'express';
import { isValidId } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { uploadChatFile } from '../middleware/upload.js';
import { Conversation, Message, User, pairKeyOf } from '../models/index.js';
import { emitToUser, isOnScreen } from '../realtime/socket.js';
import { saveFile } from '../services/files.js';
import { notify, pushCounts, unreadTotal } from '../services/notify.js';
import { areConnected } from '../services/privacy.js';
import { sendPushToUser } from '../services/push.js';
import { conversationView, messageView, SUMMARY_FIELDS } from '../services/serializers.js';
import { badRequest, cleanText, forbidden, notFound, parseLimit } from '../utils/http.js';

const router = Router();
router.use(requireAuth);

const otherId = (conversation, userId) =>
  conversation.participants.map((p) => String(p._id || p)).find((p) => p !== String(userId));

async function loadConversation(id, userId) {
  if (!isValidId(id)) throw notFound('Conversation not found.');
  const conversation = await Conversation.findOne({ _id: id, participants: userId });
  if (!conversation) throw notFound('Conversation not found.');
  return conversation;
}

async function viewFor(conversation, viewerId) {
  const other = await User.findById(otherId(conversation, viewerId)).select(SUMMARY_FIELDS).lean();
  return conversationView(conversation.toObject ? conversation.toObject() : conversation, viewerId, other);
}

router.get('/', async (req, res) => {
  const box = req.query.box === 'requests' ? 'requests' : 'inbox';
  const base = { participants: req.userId, lastMessageAt: { $ne: null } };
  const filter =
    box === 'requests'
      ? { ...base, status: 'request', requestedBy: { $ne: req.userId } }
      : {
          ...base,
          $or: [{ status: 'active' }, { status: { $in: ['request', 'declined'] }, requestedBy: req.userId }],
        };
  const conversations = await Conversation.find(filter)
    .sort({ lastMessageAt: -1 })
    .limit(parseLimit(req.query.limit, 50, 100))
    .populate('participants', SUMMARY_FIELDS)
    .lean();
  res.json({
    box,
    results: conversations.map((c) => {
      const other = c.participants.find((p) => String(p._id) !== req.userId);
      return conversationView(c, req.userId, other);
    }),
  });
});

/** Opens (or prepares) a conversation with another researcher – used by every Message button. */
router.post('/open', async (req, res) => {
  const targetId = String(req.body?.userId || '');
  if (!isValidId(targetId)) throw badRequest('Choose who to message.');
  if (targetId === req.userId) throw badRequest('You cannot message yourself.');
  const target = await User.findById(targetId).select(`${SUMMARY_FIELDS} settings`).lean();
  if (!target) throw notFound('This researcher could not be found.');

  const pairKey = pairKeyOf(req.userId, targetId);
  let conversation = await Conversation.findOne({ pairKey });
  if (!conversation) {
    const connected = await areConnected(req.userId, targetId);
    if (!connected && target.settings?.messageRequests === 'none') {
      throw forbidden(
        `${target.name.split(' ')[0]} only accepts messages from connections. Send a connection request first.`,
        'MESSAGES_RESTRICTED',
      );
    }
    conversation = await Conversation.create({
      participants: [req.userId, targetId],
      pairKey,
      status: connected ? 'active' : 'request',
      requestedBy: connected ? null : req.userId,
      acceptedAt: connected ? new Date() : null,
    });
  }
  res.json({ conversation: conversationView(conversation.toObject(), req.userId, target) });
});

router.get('/:id', async (req, res) => {
  const conversation = await loadConversation(req.params.id, req.userId);
  res.json({ conversation: await viewFor(conversation, req.userId) });
});

router.get('/:id/messages', async (req, res) => {
  const conversation = await loadConversation(req.params.id, req.userId);
  const limit = parseLimit(req.query.limit, 30, 100);
  const filter = { conversation: conversation._id };
  if (req.query.before) {
    const before = new Date(String(req.query.before));
    if (!Number.isNaN(before.getTime())) filter.createdAt = { $lt: before };
  }
  const rows = await Message.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit + 1)
    .lean();
  const hasMore = rows.length > limit;
  res.json({ results: rows.slice(0, limit).reverse().map(messageView), hasMore });
});

router.post('/:id/messages', uploadChatFile, async (req, res) => {
  const conversation = await loadConversation(req.params.id, req.userId);
  const recipientId = otherId(conversation, req.userId);
  const text = cleanText(req.body?.text, 4000);
  const clientId = cleanText(req.body?.clientId, 64);
  if (!text && !req.file) throw badRequest('Write a message or attach a file.', 'EMPTY_MESSAGE');

  const isRequester = conversation.requestedBy && String(conversation.requestedBy) === req.userId;
  const wasEmpty = !conversation.lastMessageAt;
  let acceptedNow = false;

  if (conversation.status !== 'active' && !isRequester) {
    // The person who received the request replied – that accepts it.
    conversation.status = 'active';
    conversation.acceptedAt = new Date();
    acceptedNow = true;
  }

  let kind = 'text';
  let attachment;
  if (req.file) {
    const id = await saveFile({
      buffer: req.file.buffer,
      filename: req.file.originalname || 'attachment',
      mime: req.file.mimetype,
      kind: 'chat',
      owner: req.userId,
      access: 'private',
    });
    kind = req.file.mimetype?.startsWith('image/') ? 'image' : 'file';
    attachment = { id, name: req.file.originalname || 'attachment', mime: req.file.mimetype, size: req.file.size };
  }

  const message = await Message.create({ conversation: conversation._id, sender: req.userId, text, kind, attachment });
  const preview = text || (kind === 'image' ? 'Sent a photo' : `Sent a file: ${attachment.name}`);
  conversation.lastMessage = { text: preview.slice(0, 200), kind, sender: req.userId, createdAt: message.createdAt };
  conversation.lastMessageAt = message.createdAt;
  conversation.unread.set(recipientId, (conversation.unread.get(recipientId) || 0) + 1);
  conversation.unread.set(req.userId, 0);
  await conversation.save();

  const payload = { ...messageView(message.toObject()), clientId: clientId || null };
  const [senderView, recipientView] = await Promise.all([viewFor(conversation, req.userId), viewFor(conversation, recipientId)]);
  emitToUser(req.userId, 'message:new', { message: payload, conversation: senderView });
  // A declined request stays silent for the recipient.
  if (conversation.status !== 'declined') {
    emitToUser(recipientId, 'message:new', { message: payload, conversation: recipientView });
  }

  if (acceptedNow) {
    emitToUser(recipientId, 'conversation:update', { id: String(conversation._id), status: 'active' });
    await notify({ recipient: recipientId, actor: req.userId, type: 'message_request_accepted', conversation: conversation._id });
  } else if (conversation.status === 'request' && wasEmpty) {
    await notify({ recipient: recipientId, actor: req.userId, type: 'message_request', conversation: conversation._id });
  } else if (conversation.status === 'active' && !isOnScreen(recipientId)) {
    const sender = await User.findById(req.userId).select('name').lean();
    sendPushToUser(recipientId, {
      title: sender?.name || 'New message',
      body: preview,
      url: `/chat/${conversation._id}`,
      // One notification per chat: a new message replaces the previous one.
      tag: `chat-${conversation._id}`,
      badge: await unreadTotal(recipientId),
    });
  }
  pushCounts(recipientId);
  res.status(201).json({ message: payload, conversation: senderView });
});

/** Marks the other person's messages as read and sends a read receipt. */
router.post('/:id/read', async (req, res) => {
  const conversation = await loadConversation(req.params.id, req.userId);
  const other = otherId(conversation, req.userId);
  const readAt = new Date();
  const result = await Message.updateMany({ conversation: conversation._id, sender: other, readAt: null }, { $set: { readAt } });
  if ((conversation.unread.get(req.userId) || 0) !== 0) {
    conversation.unread.set(req.userId, 0);
    await conversation.save();
  }
  // Read receipts are only shared once the conversation is accepted.
  if (conversation.status === 'active' && result.modifiedCount > 0) {
    emitToUser(other, 'message:read', { conversationId: String(conversation._id), readerId: req.userId, readAt });
  }
  pushCounts(req.userId);
  res.json({ ok: true, readAt, updated: result.modifiedCount });
});

router.post('/:id/accept', async (req, res) => {
  const conversation = await loadConversation(req.params.id, req.userId);
  if (conversation.status === 'active') return res.json({ conversation: await viewFor(conversation, req.userId) });
  if (String(conversation.requestedBy) === req.userId) throw badRequest('Waiting for the other person to accept.');
  conversation.status = 'active';
  conversation.acceptedAt = new Date();
  await conversation.save();
  const requester = String(conversation.requestedBy);
  emitToUser(requester, 'conversation:update', { id: String(conversation._id), status: 'active' });
  emitToUser(req.userId, 'conversation:update', { id: String(conversation._id), status: 'active' });
  await notify({ recipient: requester, actor: req.userId, type: 'message_request_accepted', conversation: conversation._id });
  pushCounts(req.userId);
  res.json({ conversation: await viewFor(conversation, req.userId) });
});

router.post('/:id/decline', async (req, res) => {
  const conversation = await loadConversation(req.params.id, req.userId);
  if (conversation.status !== 'request' || String(conversation.requestedBy) === req.userId) {
    throw badRequest('Only pending requests you received can be declined.');
  }
  conversation.status = 'declined';
  await conversation.save();
  emitToUser(req.userId, 'conversation:update', { id: String(conversation._id), status: 'declined' });
  pushCounts(req.userId);
  res.json({ ok: true });
});

export default router;
