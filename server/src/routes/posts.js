import { Router } from 'express';
import { config } from '../config.js';
import { POST_CATEGORIES, POST_KINDS } from '../constants.js';
import { isValidId } from '../db.js';
import { isAdmin, optionalAuth, requireAuth } from '../middleware/auth.js';
import { uploadPostMedia } from '../middleware/upload.js';
import { Comment, Notification, Paper, Post } from '../models/index.js';
import { deleteFile, saveFile } from '../services/files.js';
import { moderateComment, moderatePost } from '../services/moderation.js';
import { notify, retractNotifications } from '../services/notify.js';
import { getConnectionIds } from '../services/privacy.js';
import { commentView, postView, SUMMARY_FIELDS } from '../services/serializers.js';
import { badRequest, cleanText, forbidden, HttpError, normalizeUrl, notFound, parseLimit } from '../utils/http.js';

const router = Router();

const PAPER_FIELDS = 'title venue year authors kind viewAccess downloadAccess owner';

export const COMMUNITY_GUIDELINES = [
  'Share research: updates, publications, preprints, datasets, methods, events and academic questions.',
  'Photos and short videos must show research context – figures, lab or field work, equipment, posters or talks.',
  'Memes, reels, jokes, reaction images, giveaways, ads and explicit content are removed.',
  'Keep language professional and respectful. Critique ideas, not people.',
  'Only share papers you authored or have the right to share.',
];

async function viewerContext(viewerId) {
  if (!viewerId) return { viewerId: null, connectedIds: new Set() };
  const ids = await getConnectionIds(viewerId);
  return { viewerId, connectedIds: new Set(ids.map(String)) };
}

async function likedSet(postIds, viewerId) {
  if (!viewerId || !postIds.length) return new Set();
  const rows = await Post.find({ _id: { $in: postIds }, likes: viewerId })
    .select('_id')
    .lean();
  return new Set(rows.map((r) => String(r._id)));
}

async function renderPosts(posts, ctx) {
  const liked = await likedSet(
    posts.map((p) => p._id),
    ctx.viewerId,
  );
  return posts.map((p) => postView(p, { ...ctx, likedIds: liked }));
}

function canSeePost(post, ctx, viewer) {
  const authorId = String(post.author?._id || post.author);
  const isOwner = ctx.viewerId && authorId === String(ctx.viewerId);
  if (post.moderation?.status !== 'approved' && !isOwner && !isAdmin(viewer)) return false;
  if (post.audience === 'connections' && !isOwner && !ctx.connectedIds.has(authorId) && !isAdmin(viewer)) return false;
  return true;
}

async function loadVisiblePost(id, req, select = '') {
  if (!isValidId(id)) throw notFound('Post not found.');
  const post = await Post.findById(id).select(select).lean();
  if (!post) throw notFound('Post not found.');
  const ctx = await viewerContext(req.userId);
  if (!canSeePost(post, ctx, req.user)) throw notFound('This post is not available.');
  return { post, ctx };
}

router.get('/meta', (_req, res) => {
  res.json({ categories: POST_CATEGORIES, guidelines: COMMUNITY_GUIDELINES, reportThreshold: config.reportThreshold });
});

router.get('/feed', requireAuth, async (req, res) => {
  const ctx = await viewerContext(req.userId);
  const network = [...ctx.connectedIds, req.userId];
  const limit = parseLimit(req.query.limit, 10, 30);
  const filter = { 'moderation.status': 'approved' };
  if (req.query.scope === 'network') filter.author = { $in: network };
  else filter.$or = [{ audience: 'public' }, { author: { $in: network } }];
  if (POST_CATEGORIES.includes(req.query.category)) filter.category = req.query.category;
  if (req.query.cursor) {
    const cursor = new Date(String(req.query.cursor));
    if (!Number.isNaN(cursor.getTime())) filter.createdAt = { $lt: cursor };
  }
  const rows = await Post.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit + 1)
    .populate('author', SUMMARY_FIELDS)
    .populate('paper', PAPER_FIELDS)
    .lean();
  const page = rows.slice(0, limit);
  res.json({
    results: await renderPosts(page, ctx),
    nextCursor: rows.length > limit ? page[page.length - 1].createdAt : null,
  });
});

router.get('/user/:userId', optionalAuth, async (req, res) => {
  if (!isValidId(req.params.userId)) throw notFound('Researcher not found.');
  const ctx = await viewerContext(req.userId);
  const authorId = req.params.userId;
  const isOwner = req.userId === authorId;
  const limit = parseLimit(req.query.limit, 10, 30);
  const filter = { author: authorId };
  filter['moderation.status'] = isOwner ? { $in: ['approved', 'flagged'] } : 'approved';
  if (!isOwner && !ctx.connectedIds.has(authorId)) filter.audience = 'public';
  if (req.query.cursor) {
    const cursor = new Date(String(req.query.cursor));
    if (!Number.isNaN(cursor.getTime())) filter.createdAt = { $lt: cursor };
  }
  const rows = await Post.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit + 1)
    .populate('author', SUMMARY_FIELDS)
    .populate('paper', PAPER_FIELDS)
    .lean();
  const page = rows.slice(0, limit);
  res.json({ results: await renderPosts(page, ctx), nextCursor: rows.length > limit ? page[page.length - 1].createdAt : null });
});

router.post('/', requireAuth, uploadPostMedia, async (req, res) => {
  const body = req.body || {};
  const files = req.files || [];
  const kind = POST_KINDS.includes(body.kind) ? body.kind : 'update';
  const text = cleanText(body.text, 3000);
  const category = String(body.category || '');
  const audience = body.audience === 'connections' ? 'connections' : 'public';
  if (!POST_CATEGORIES.includes(category)) throw badRequest('Choose a research category for your post.', 'INVALID_CATEGORY');

  const post = new Post({ author: req.userId, kind, text, category, audience });

  let linkUrl = '';
  if (kind === 'link') {
    linkUrl = normalizeUrl(body.link);
    if (!linkUrl) throw badRequest('Add a valid research link (DOI, arXiv, journal or dataset).', 'INVALID_LINK');
    post.link = { url: linkUrl, domain: new URL(linkUrl).hostname.replace(/^www\./, '') };
  }

  if (kind === 'paper') {
    if (!isValidId(String(body.paperId || ''))) throw badRequest('Choose one of your papers to share.', 'INVALID_PAPER');
    const paper = await Paper.findOne({ _id: body.paperId, owner: req.userId }).select('viewAccess').lean();
    if (!paper) throw badRequest('You can only share papers from your own portfolio.', 'INVALID_PAPER');
    if (paper.viewAccess === 'private') {
      throw badRequest('This paper is set to "Only me". Change its visibility before sharing it.', 'PAPER_PRIVATE');
    }
    post.paper = paper._id;
  }

  const verdict = await moderatePost({ kind, text, linkUrl, files: kind === 'media' ? files : [] });
  if (!verdict.approved) {
    throw new HttpError(422, 'Your post was not published.', 'MODERATION_REJECTED', { reasons: verdict.reasons });
  }
  post.moderation = { status: 'approved', checks: verdict.checks };

  if (kind === 'media') {
    for (const file of files) {
      const access = audience === 'public' ? 'public' : 'private';
      const id = await saveFile({
        buffer: file.buffer,
        filename: file.originalname || 'media',
        mime: file.mimetype,
        kind: 'post',
        owner: req.userId,
        access,
      });
      post.media.push({ id, kind: file.mimetype.startsWith('video/') ? 'video' : 'image', mime: file.mimetype, access });
    }
  }

  await post.save();
  const saved = await Post.findById(post._id).populate('author', SUMMARY_FIELDS).populate('paper', PAPER_FIELDS).lean();
  const ctx = await viewerContext(req.userId);
  res.status(201).json({ post: postView(saved, { ...ctx, likedIds: new Set() }) });
});

router.get('/:id', optionalAuth, async (req, res) => {
  const { post, ctx } = await loadVisiblePost(req.params.id, req);
  const full = await Post.findById(post._id).populate('author', SUMMARY_FIELDS).populate('paper', PAPER_FIELDS).lean();
  const [view] = await renderPosts([full], ctx);
  res.json({ post: view });
});

router.delete('/:id', requireAuth, async (req, res) => {
  if (!isValidId(req.params.id)) throw notFound('Post not found.');
  const post = await Post.findById(req.params.id).lean();
  if (!post) throw notFound('Post not found.');
  if (String(post.author) !== req.userId && !isAdmin(req.user)) throw forbidden('Only the author can delete this post.');
  await Promise.all([
    ...(post.media || []).map((m) => deleteFile(m.id)),
    Comment.deleteMany({ post: post._id }),
    Notification.deleteMany({ post: post._id }),
    Post.deleteOne({ _id: post._id }),
  ]);
  res.json({ ok: true });
});

/** Like or unlike. Send { like: true|false } for an explicit state, or nothing to toggle. */
router.post('/:id/like', requireAuth, async (req, res) => {
  const { post } = await loadVisiblePost(req.params.id, req);
  if (post.moderation?.status !== 'approved') throw badRequest('This post is under review.');
  const me = req.userId;
  let want = req.body?.like;
  if (typeof want !== 'boolean') {
    want = !(await Post.exists({ _id: post._id, likes: me }));
  }
  if (want) {
    const r = await Post.updateOne({ _id: post._id, likes: { $ne: me } }, { $addToSet: { likes: me }, $inc: { likeCount: 1 } });
    if (r.modifiedCount) await notify({ recipient: post.author, actor: me, type: 'post_like', post: post._id });
  } else {
    const r = await Post.updateOne({ _id: post._id, likes: me }, { $pull: { likes: me }, $inc: { likeCount: -1 } });
    if (r.modifiedCount) await retractNotifications({ post: post._id, actor: me, type: 'post_like' });
  }
  const fresh = await Post.findById(post._id).select('likeCount').lean();
  res.json({ liked: want, likeCount: Math.max(fresh?.likeCount || 0, 0) });
});

router.get('/:id/comments', optionalAuth, async (req, res) => {
  const { post } = await loadVisiblePost(req.params.id, req);
  const comments = await Comment.find({ post: post._id })
    .sort({ createdAt: 1 })
    .limit(300)
    .populate('author', SUMMARY_FIELDS)
    .lean();
  res.json({ results: comments.map((c) => commentView(c, req.userId)) });
});

router.post('/:id/comments', requireAuth, async (req, res) => {
  const { post } = await loadVisiblePost(req.params.id, req);
  if (post.moderation?.status !== 'approved') throw badRequest('This post is under review.');
  const text = cleanText(req.body?.text, 1500);
  const reasons = moderateComment(text);
  if (reasons.length) throw new HttpError(422, 'Your comment was not posted.', 'MODERATION_REJECTED', { reasons });
  const comment = await Comment.create({ post: post._id, author: req.userId, text });
  await Post.updateOne({ _id: post._id }, { $inc: { commentCount: 1 } });
  await notify({ recipient: post.author, actor: req.userId, type: 'post_comment', post: post._id, snippet: text.slice(0, 90) });
  const populated = await Comment.findById(comment._id).populate('author', SUMMARY_FIELDS).lean();
  res.status(201).json({ comment: commentView(populated, req.userId) });
});

router.delete('/:id/comments/:commentId', requireAuth, async (req, res) => {
  if (!isValidId(req.params.commentId)) throw notFound('Comment not found.');
  const comment = await Comment.findOne({ _id: req.params.commentId, post: req.params.id }).lean();
  if (!comment) throw notFound('Comment not found.');
  const post = await Post.findById(comment.post).select('author').lean();
  const allowed = String(comment.author) === req.userId || String(post?.author) === req.userId || isAdmin(req.user);
  if (!allowed) throw forbidden('You can only delete your own comments.');
  await Comment.deleteOne({ _id: comment._id });
  await Post.updateOne({ _id: comment.post, commentCount: { $gt: 0 } }, { $inc: { commentCount: -1 } });
  res.json({ ok: true });
});

/** Community report. Enough reports hide the post until a moderator reviews it. */
router.post('/:id/report', requireAuth, async (req, res) => {
  const { post } = await loadVisiblePost(req.params.id, req);
  if (String(post.author) === req.userId) throw badRequest('You cannot report your own post.');
  const reason = cleanText(req.body?.reason, 300) || 'Not academic content';
  const result = await Post.updateOne(
    { _id: post._id, 'reports.user': { $ne: req.userId } },
    { $push: { reports: { user: req.userId, reason, at: new Date() } } },
  );
  if (result.modifiedCount) {
    const fresh = await Post.findById(post._id).select('+reports moderation author').lean();
    if (fresh.moderation.status === 'approved' && fresh.reports.length >= config.reportThreshold) {
      await Post.updateOne({ _id: post._id }, { $set: { 'moderation.status': 'flagged' } });
      await notify({ recipient: fresh.author, type: 'post_flagged', post: post._id });
    }
  }
  res.json({ reported: true });
});

export default router;
