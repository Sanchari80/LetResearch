import { Router } from 'express';
import { NOTIFICATION_TYPES_BY_CATEGORY } from '../constants.js';
import { isValidId } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { Notification } from '../models/index.js';
import { pushCounts } from '../services/notify.js';
import { notificationView, SUMMARY_FIELDS } from '../services/serializers.js';
import { notFound, parseLimit } from '../utils/http.js';

const router = Router();
router.use(requireAuth);

function categoryFilter(category) {
  const types = NOTIFICATION_TYPES_BY_CATEGORY[category];
  return types ? { type: { $in: types } } : {};
}

router.get('/', async (req, res) => {
  const category = String(req.query.category || 'all');
  const limit = parseLimit(req.query.limit, 30, 60);
  const filter = { recipient: req.userId, ...categoryFilter(category) };
  if (req.query.cursor) {
    const cursor = new Date(String(req.query.cursor));
    if (!Number.isNaN(cursor.getTime())) filter.createdAt = { $lt: cursor };
  }
  const rows = await Notification.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit + 1)
    .populate('actor', SUMMARY_FIELDS)
    .populate('paper', 'title')
    .lean();
  const page = rows.slice(0, limit);
  const unreadByCategory = {};
  for (const key of Object.keys(NOTIFICATION_TYPES_BY_CATEGORY)) {
    unreadByCategory[key] = await Notification.countDocuments({ recipient: req.userId, read: false, ...categoryFilter(key) });
  }
  res.json({
    results: page.map(notificationView),
    nextCursor: rows.length > limit ? page[page.length - 1].createdAt : null,
    unreadByCategory,
  });
});

router.post('/read-all', async (req, res) => {
  const category = String(req.body?.category || 'all');
  await Notification.updateMany({ recipient: req.userId, read: false, ...categoryFilter(category) }, { $set: { read: true } });
  pushCounts(req.userId);
  res.json({ ok: true });
});

router.post('/:id/read', async (req, res) => {
  if (!isValidId(req.params.id)) throw notFound('Notification not found.');
  await Notification.updateOne({ _id: req.params.id, recipient: req.userId }, { $set: { read: true } });
  pushCounts(req.userId);
  res.json({ ok: true });
});

router.delete('/:id', async (req, res) => {
  if (!isValidId(req.params.id)) throw notFound('Notification not found.');
  await Notification.deleteOne({ _id: req.params.id, recipient: req.userId });
  pushCounts(req.userId);
  res.json({ ok: true });
});

export default router;
