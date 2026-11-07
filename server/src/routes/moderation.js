import { Router } from 'express';
import { isValidId } from '../db.js';
import { requireAdmin, requireAuth } from '../middleware/auth.js';
import { Post } from '../models/index.js';
import { notify } from '../services/notify.js';
import { postView, SUMMARY_FIELDS } from '../services/serializers.js';
import { cleanText, notFound } from '../utils/http.js';

const router = Router();
router.use(requireAuth, requireAdmin);

/** Posts hidden by community reports, waiting for a moderator. */
router.get('/queue', async (_req, res) => {
  const posts = await Post.find({ 'moderation.status': 'flagged' })
    .select('+reports')
    .sort({ updatedAt: -1 })
    .limit(100)
    .populate('author', SUMMARY_FIELDS)
    .populate('paper', 'title venue year authors kind viewAccess downloadAccess owner')
    .lean();
  res.json({
    results: posts.map((p) => ({
      ...postView(p, { viewerId: null }),
      reports: (p.reports || []).map((r) => ({ reason: r.reason, at: r.at })),
    })),
  });
});

async function review(req, status) {
  if (!isValidId(req.params.id)) throw notFound('Post not found.');
  const post = await Post.findByIdAndUpdate(
    req.params.id,
    {
      $set: {
        'moderation.status': status,
        'moderation.reviewedBy': req.userId,
        'moderation.reviewedAt': new Date(),
        ...(status === 'approved' ? { reports: [] } : {}),
      },
    },
    { new: true },
  ).lean();
  if (!post) throw notFound('Post not found.');
  return post;
}

router.post('/posts/:id/approve', async (req, res) => {
  const post = await review(req, 'approved');
  await notify({ recipient: post.author, type: 'post_restored', post: post._id });
  res.json({ ok: true });
});

router.post('/posts/:id/remove', async (req, res) => {
  const post = await review(req, 'removed');
  await notify({ recipient: post.author, type: 'post_removed', post: post._id, snippet: cleanText(req.body?.reason, 160) });
  res.json({ ok: true });
});

export default router;
