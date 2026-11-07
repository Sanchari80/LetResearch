import { Router } from 'express';
import { isValidId } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { Connection, Conversation, User, pairKeyOf } from '../models/index.js';
import { emitToUsers } from '../realtime/socket.js';
import { notify, pushCounts, retractNotifications } from '../services/notify.js';
import { SUMMARY_FIELDS, userSummary } from '../services/serializers.js';
import { badRequest, conflict, forbidden, notFound } from '../utils/http.js';

const router = Router();
router.use(requireAuth);

/** When two people connect, any pending message request between them becomes a normal chat. */
async function activateConversation(a, b) {
  const conversation = await Conversation.findOneAndUpdate(
    { pairKey: pairKeyOf(a, b), status: { $in: ['request', 'declined'] } },
    { $set: { status: 'active', acceptedAt: new Date() } },
    { new: true },
  ).lean();
  if (conversation) emitToUsers([a, b], 'conversation:update', { id: String(conversation._id), status: 'active' });
}

function emitRelation(connection, status) {
  const payload = {
    connectionId: String(connection._id),
    requesterId: String(connection.requester),
    recipientId: String(connection.recipient),
    status,
  };
  emitToUsers([connection.requester, connection.recipient], 'connection:update', payload);
}

router.get('/', async (req, res) => {
  const rows = await Connection.find({ status: 'accepted', $or: [{ requester: req.userId }, { recipient: req.userId }] })
    .sort({ respondedAt: -1 })
    .populate('requester', SUMMARY_FIELDS)
    .populate('recipient', SUMMARY_FIELDS)
    .lean();
  res.json({
    results: rows
      .map((r) => {
        const other = String(r.requester?._id) === req.userId ? r.recipient : r.requester;
        return other ? { connectionId: String(r._id), since: r.respondedAt, user: userSummary(other) } : null;
      })
      .filter(Boolean),
  });
});

router.get('/requests', async (req, res) => {
  const [received, sent] = await Promise.all([
    Connection.find({ recipient: req.userId, status: 'pending' })
      .sort({ createdAt: -1 })
      .populate('requester', SUMMARY_FIELDS)
      .lean(),
    Connection.find({ requester: req.userId, status: 'pending' })
      .sort({ createdAt: -1 })
      .populate('recipient', SUMMARY_FIELDS)
      .lean(),
  ]);
  res.json({
    received: received
      .filter((r) => r.requester)
      .map((r) => ({ id: String(r._id), user: userSummary(r.requester), createdAt: r.createdAt })),
    sent: sent
      .filter((r) => r.recipient)
      .map((r) => ({ id: String(r._id), user: userSummary(r.recipient), createdAt: r.createdAt })),
  });
});

router.post('/request', async (req, res) => {
  const targetId = String(req.body?.userId || '');
  if (!isValidId(targetId)) throw badRequest('Choose a researcher to connect with.');
  if (targetId === req.userId) throw badRequest('You cannot connect with yourself.');
  if (!(await User.exists({ _id: targetId }))) throw notFound('This researcher could not be found.');

  const pairKey = pairKeyOf(req.userId, targetId);
  const existing = await Connection.findOne({ pairKey });
  if (existing) {
    if (existing.status === 'accepted') throw conflict('You are already connected.', 'ALREADY_CONNECTED');
    if (String(existing.requester) === req.userId) throw conflict('Your request is already pending.', 'ALREADY_PENDING');
    // They already asked us – sending a request back simply accepts theirs.
    existing.status = 'accepted';
    existing.respondedAt = new Date();
    await existing.save();
    await retractNotifications({ connection: existing._id, type: 'connection_request' });
    await notify({ recipient: existing.requester, actor: req.userId, type: 'connection_accepted', connection: existing._id });
    await activateConversation(req.userId, targetId);
    emitRelation(existing, 'accepted');
    pushCounts(req.userId);
    return res.json({ status: 'connected', connectionId: String(existing._id) });
  }

  const connection = await Connection.create({ requester: req.userId, recipient: targetId, pairKey });
  await notify({ recipient: targetId, actor: req.userId, type: 'connection_request', connection: connection._id });
  emitRelation(connection, 'pending');
  res.status(201).json({ status: 'pending_sent', connectionId: String(connection._id) });
});

async function loadPending(id, userId) {
  if (!isValidId(id)) throw notFound('Request not found.');
  const connection = await Connection.findById(id);
  if (!connection || connection.status !== 'pending') throw notFound('This request is no longer pending.');
  if (String(connection.recipient) !== String(userId)) throw forbidden('Only the recipient can answer this request.');
  return connection;
}

router.post('/:id/accept', async (req, res) => {
  const connection = await loadPending(req.params.id, req.userId);
  connection.status = 'accepted';
  connection.respondedAt = new Date();
  await connection.save();
  await retractNotifications({ connection: connection._id, type: 'connection_request' });
  await notify({ recipient: connection.requester, actor: req.userId, type: 'connection_accepted', connection: connection._id });
  await activateConversation(connection.requester, connection.recipient);
  emitRelation(connection, 'accepted');
  pushCounts(req.userId);
  res.json({ status: 'connected', connectionId: String(connection._id) });
});

router.post('/:id/decline', async (req, res) => {
  const connection = await loadPending(req.params.id, req.userId);
  await retractNotifications({ connection: connection._id });
  await connection.deleteOne();
  emitRelation(connection, 'none');
  pushCounts(req.userId);
  res.json({ status: 'none' });
});

/** Withdraw a sent request, or remove an existing connection. */
router.delete('/:id', async (req, res) => {
  if (!isValidId(req.params.id)) throw notFound('Connection not found.');
  const connection = await Connection.findById(req.params.id);
  if (!connection) throw notFound('Connection not found.');
  const mine = [String(connection.requester), String(connection.recipient)].includes(req.userId);
  if (!mine) throw forbidden();
  if (connection.status === 'pending' && String(connection.requester) !== req.userId) {
    throw badRequest('Use decline to answer a request you received.');
  }
  await retractNotifications({ connection: connection._id });
  await connection.deleteOne();
  emitRelation(connection, 'none');
  pushCounts(String(connection.requester));
  pushCounts(String(connection.recipient));
  res.json({ status: 'none' });
});

export default router;
