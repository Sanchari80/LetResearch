import { Router } from 'express';
import { ALL_VISIBILITY_FIELDS, LINK_FIELDS, VISIBILITY } from '../constants.js';
import { isValidId } from '../db.js';
import { optionalAuth, requireAuth } from '../middleware/auth.js';
import { uploadImage } from '../middleware/upload.js';
import { Connection, Conversation, Paper, Post, User, pairKeyOf } from '../models/index.js';
import { deleteFile, saveFile } from '../services/files.js';
import { getCounts } from '../services/notify.js';
import { getRelation } from '../services/privacy.js';
import { paperIndexForViewer, profileForViewer, SUMMARY_FIELDS, userSummary, visibilityOf } from '../services/serializers.js';
import { badRequest, cleanList, cleanText, conflict, escapeRegex, notFound, parseLimit } from '../utils/http.js';
import { RESERVED_USERNAMES, USERNAME_PATTERN } from '../utils/username.js';

const router = Router();

const LINK_LIMITS = {
  email: 160,
  phone: 40,
  whatsapp: 40,
  telegram: 120,
  twitter: 120,
};

async function findByHandle(handle) {
  const value = String(handle || '').trim();
  if (isValidId(value)) return User.findById(value).lean();
  return User.findOne({ username: value.toLowerCase() }).lean();
}

// ---------------------------------------------------------------------------
// The signed-in user's own account
// ---------------------------------------------------------------------------

router.get('/me/counts', requireAuth, async (req, res) => {
  res.json(await getCounts(req.userId));
});

router.patch('/me', requireAuth, async (req, res) => {
  const body = req.body || {};
  const set = {};

  if (body.name !== undefined) {
    const name = cleanText(body.name, 80);
    if (name.length < 2) throw badRequest('Enter your full name.', 'INVALID_NAME');
    set.name = name;
  }
  if (body.headline !== undefined) set.headline = cleanText(body.headline, 140);
  if (body.openToCollaborate !== undefined) set.openToCollaborate = !!body.openToCollaborate;
  if (body.username !== undefined) {
    const username = cleanText(body.username, 30).toLowerCase();
    if (!USERNAME_PATTERN.test(username) || RESERVED_USERNAMES.has(username)) {
      throw badRequest('Usernames use 3–30 lowercase letters, numbers, dots, dashes or underscores.', 'INVALID_USERNAME');
    }
    if (await User.exists({ username, _id: { $ne: req.userId } })) throw conflict('That username is taken.', 'USERNAME_TAKEN');
    set.username = username;
  }

  if (body.profile && typeof body.profile === 'object') {
    const p = body.profile;
    if (p.qualification !== undefined) set['profile.qualification'] = cleanText(p.qualification, 140);
    if (p.institution !== undefined) set['profile.institution'] = cleanText(p.institution, 140);
    if (p.location !== undefined) set['profile.location'] = cleanText(p.location, 120);
    if (p.bio !== undefined) set['profile.bio'] = cleanText(p.bio, 1200);
    if (p.interests !== undefined) set['profile.interests'] = cleanList(p.interests, { maxItems: 15, maxLength: 50 });
  }

  if (body.links && typeof body.links === 'object') {
    for (const field of LINK_FIELDS) {
      if (body.links[field] !== undefined) set[`links.${field}`] = cleanText(body.links[field], LINK_LIMITS[field] || 300);
    }
  }

  if (body.visibility && typeof body.visibility === 'object') {
    for (const field of ALL_VISIBILITY_FIELDS) {
      const value = body.visibility[field];
      if (value === undefined) continue;
      if (!VISIBILITY.includes(value)) throw badRequest(`Invalid visibility for ${field}.`, 'INVALID_VISIBILITY');
      set[`visibility.${field}`] = value;
    }
  }

  if (body.settings && typeof body.settings === 'object') {
    if (body.settings.messageRequests !== undefined) {
      if (!['everyone', 'none'].includes(body.settings.messageRequests)) throw badRequest('Invalid setting.');
      set['settings.messageRequests'] = body.settings.messageRequests;
    }
  }

  const user = await User.findByIdAndUpdate(req.userId, { $set: set }, { new: true, runValidators: true }).lean();
  res.json({ user: profileForViewer(user, 'self') });
});

/** Instant privacy toggle for a single detail: { field, visibility }. */
router.patch('/me/visibility', requireAuth, async (req, res) => {
  const { field, visibility } = req.body || {};
  if (!ALL_VISIBILITY_FIELDS.includes(field)) throw badRequest('Unknown profile detail.', 'INVALID_FIELD');
  if (!VISIBILITY.includes(visibility)) throw badRequest('Choose Public, Connections or Only me.', 'INVALID_VISIBILITY');
  const user = await User.findByIdAndUpdate(req.userId, { $set: { [`visibility.${field}`]: visibility } }, { new: true }).lean();
  res.json({ field, visibility, visibilityMap: visibilityOf(user) });
});

for (const kind of ['avatar', 'cover']) {
  router.post(`/me/${kind}`, requireAuth, uploadImage, async (req, res) => {
    if (!req.file) throw badRequest('Choose an image to upload.', 'NO_FILE');
    const id = await saveFile({
      buffer: req.file.buffer,
      filename: req.file.originalname || `${kind}.jpg`,
      mime: req.file.mimetype,
      kind,
      owner: req.userId,
      access: 'public',
    });
    const previous = await User.findById(req.userId).select(kind).lean();
    const user = await User.findByIdAndUpdate(req.userId, { $set: { [kind]: id } }, { new: true }).lean();
    if (previous?.[kind]) await deleteFile(previous[kind]);
    res.json({ user: profileForViewer(user, 'self') });
  });

  router.delete(`/me/${kind}`, requireAuth, async (req, res) => {
    const previous = await User.findById(req.userId).select(kind).lean();
    const user = await User.findByIdAndUpdate(req.userId, { $set: { [kind]: null } }, { new: true }).lean();
    if (previous?.[kind]) await deleteFile(previous[kind]);
    res.json({ user: profileForViewer(user, 'self') });
  });
}

// ---------------------------------------------------------------------------
// Discovery
// ---------------------------------------------------------------------------

router.get('/search', requireAuth, async (req, res) => {
  const q = cleanText(req.query.q, 80);
  if (q.length < 2) return res.json({ results: [] });
  const re = new RegExp(escapeRegex(q), 'i');
  const users = await User.find({
    _id: { $ne: req.userId },
    $or: [
      { name: re },
      { username: re },
      { headline: re },
      { 'profile.institution': re, 'visibility.institution': 'public' },
      { 'profile.interests': re, 'visibility.interests': 'public' },
    ],
  })
    .select(SUMMARY_FIELDS)
    .limit(parseLimit(req.query.limit, 20, 40))
    .lean();
  res.json({ results: users.map(userSummary) });
});

const firstPart = (location) =>
  String(location || '')
    .split(',')[0]
    .trim()
    .toLowerCase();

router.get('/suggestions', requireAuth, async (req, res) => {
  const filter = ['location', 'interests', 'institution'].includes(req.query.filter) ? req.query.filter : 'all';
  const me = await User.findById(req.userId).lean();
  const myInterests = new Map((me.profile?.interests || []).map((i) => [i.toLowerCase(), i]));
  const myCity = firstPart(me.profile?.location);
  const myInstitution = String(me.profile?.institution || '')
    .trim()
    .toLowerCase();

  const links = await Connection.find({ $or: [{ requester: req.userId }, { recipient: req.userId }] })
    .select('requester recipient')
    .lean();
  const excluded = new Set([String(req.userId)]);
  for (const l of links) {
    excluded.add(String(l.requester));
    excluded.add(String(l.recipient));
  }

  const candidates = await User.find({ _id: { $nin: [...excluded] } })
    .select('name username headline avatar openToCollaborate lastSeenAt profile visibility createdAt')
    .sort({ createdAt: -1 })
    .limit(400)
    .lean();

  const scored = candidates.map((user) => {
    const vis = visibilityOf(user);
    const theirInterests = vis.interests === 'public' ? user.profile?.interests || [] : [];
    const shared = theirInterests.filter((i) => myInterests.has(i.toLowerCase()));
    const city = vis.location === 'public' ? firstPart(user.profile?.location) : '';
    const institution =
      vis.institution === 'public'
        ? String(user.profile?.institution || '')
            .trim()
            .toLowerCase()
        : '';
    const sameCity = !!myCity && city === myCity;
    const sameInstitution = !!myInstitution && institution === myInstitution;
    let score = shared.length * 3 + (sameCity ? 2 : 0) + (sameInstitution ? 3 : 0) + (user.openToCollaborate ? 0.5 : 0);
    if (user.avatar) score += 0.2;
    let reason = 'New on LetResearch';
    if (shared.length) reason = `Shares your interest in ${shared.slice(0, 2).join(' and ')}`;
    else if (sameInstitution) reason = `Also at ${user.profile.institution}`;
    else if (sameCity) reason = `Also based in ${user.profile.location.split(',')[0].trim()}`;
    return {
      score,
      sameCity,
      sameInstitution,
      shared,
      view: {
        ...userSummary(user),
        location: vis.location === 'public' ? user.profile?.location || '' : '',
        interests: theirInterests.slice(0, 6),
        sharedInterests: shared,
        reason,
      },
    };
  });

  const filtered = scored.filter((s) => {
    if (filter === 'location') return s.sameCity;
    if (filter === 'interests') return s.shared.length > 0;
    if (filter === 'institution') return s.sameInstitution;
    return true;
  });
  filtered.sort((a, b) => b.score - a.score);
  res.json({
    filter,
    hasLocation: !!myCity,
    hasInterests: myInterests.size > 0,
    hasInstitution: !!myInstitution,
    results: filtered.slice(0, parseLimit(req.query.limit, 24, 50)).map((s) => s.view),
  });
});

// ---------------------------------------------------------------------------
// Public profiles (signed-in or anonymous visitors from a shared profile link)
// ---------------------------------------------------------------------------

router.get('/:handle', optionalAuth, async (req, res) => {
  const user = await findByHandle(req.params.handle);
  if (!user) throw notFound('This researcher could not be found.');
  const relation = await getRelation(req.userId, user._id);
  const status = relation.status;

  const papers = await Paper.find({ owner: user._id }).sort({ order: 1, createdAt: -1 }).lean();
  const paperIndex = paperIndexForViewer(papers, status);

  const postFilter = { author: user._id, 'moderation.status': 'approved' };
  if (!['self', 'connected'].includes(status)) postFilter.audience = 'public';
  const [connections, posts] = await Promise.all([
    Connection.countDocuments({ status: 'accepted', $or: [{ requester: user._id }, { recipient: user._id }] }),
    Post.countDocuments(postFilter),
  ]);

  let conversationId = null;
  if (req.userId && status !== 'self') {
    const conversation = await Conversation.findOne({ pairKey: pairKeyOf(req.userId, user._id) })
      .select('_id')
      .lean();
    conversationId = conversation ? String(conversation._id) : null;
  }

  const acceptsRequests = (user.settings?.messageRequests || 'everyone') === 'everyone';
  const canMessage =
    status === 'connected' || (status !== 'self' && status !== 'anonymous' && acceptsRequests) || !!conversationId;

  res.json({
    user: profileForViewer(user, status),
    relation,
    stats: { connections, posts, papers: paperIndex.length },
    paperIndex,
    conversationId,
    canMessage,
    messageNote:
      status === 'anonymous'
        ? 'Sign in to message this researcher.'
        : !canMessage && status !== 'self'
          ? `${user.name.split(' ')[0]} only accepts messages from connections. Send a connection request first.`
          : '',
  });
});

router.get('/:handle/connections', optionalAuth, async (req, res) => {
  const user = await findByHandle(req.params.handle);
  if (!user) throw notFound('This researcher could not be found.');
  const { status } = await getRelation(req.userId, user._id);
  const vis = visibilityOf(user);
  const allowed =
    status === 'self' || vis.connectionsList === 'public' || (vis.connectionsList === 'connections' && status === 'connected');
  if (!allowed) return res.json({ hidden: true, results: [] });
  const rows = await Connection.find({ status: 'accepted', $or: [{ requester: user._id }, { recipient: user._id }] })
    .sort({ respondedAt: -1 })
    .limit(500)
    .populate('requester', SUMMARY_FIELDS)
    .populate('recipient', SUMMARY_FIELDS)
    .lean();
  const results = rows
    .map((r) => (String(r.requester?._id) === String(user._id) ? r.recipient : r.requester))
    .filter(Boolean)
    .map(userSummary);
  res.json({ hidden: false, results });
});

export default router;
