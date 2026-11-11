import { Router } from 'express';
import { PAPER_DOWNLOAD_ACCESS, PAPER_VIEW_ACCESS } from '../constants.js';
import { isValidId } from '../db.js';
import { optionalAuth, requireAuth } from '../middleware/auth.js';
import { uploadPaperFile } from '../middleware/upload.js';
import { Notification, Paper, PaperDownload, Post } from '../models/index.js';
import { deleteFile, saveFile, signedFileUrl } from '../services/files.js';
import { notify, pushCounts } from '../services/notify.js';
import { paperPricing } from '../services/paper-pricing.js';
import { canDownloadPaper, canViewPaper, downloadBlockReason, getRelation } from '../services/privacy.js';
import { paperDetail, paperSummary, SUMMARY_FIELDS, userSummary } from '../services/serializers.js';
import { badRequest, cleanList, cleanText, forbidden, HttpError, normalizeUrl, notFound, parseBool } from '../utils/http.js';

const router = Router();

router.get('/pricing', (_req, res) => {
  res.json({ pricing: paperPricing() });
});

function readPaperFields(body, { partial = false } = {}) {
  const fields = {};
  const has = (key) => body[key] !== undefined;

  if (!partial || has('title')) {
    const title = cleanText(body.title, 300);
    if (title.length < 3) throw badRequest('Enter the paper title (at least 3 characters).', 'INVALID_TITLE');
    fields.title = title;
  }
  if (has('abstract')) fields.abstract = cleanText(body.abstract, 6000);
  if (has('authors')) fields.authors = cleanList(body.authors, { maxItems: 40, maxLength: 80 });
  if (has('venue')) fields.venue = cleanText(body.venue, 200);
  if (has('keywords')) fields.keywords = cleanList(body.keywords, { maxItems: 12, maxLength: 40 });
  if (has('doi')) fields.doi = cleanText(body.doi, 200).replace(/^https?:\/\/(dx\.)?doi\.org\//i, '');
  if (has('year')) {
    const year = Number(body.year);
    const max = new Date().getFullYear() + 1;
    if (body.year === '' || body.year === null) fields.year = null;
    else if (!Number.isInteger(year) || year < 1900 || year > max)
      throw badRequest(`Year must be between 1900 and ${max}.`, 'INVALID_YEAR');
    else fields.year = year;
  }
  if (has('viewAccess')) {
    if (!PAPER_VIEW_ACCESS.includes(body.viewAccess)) throw badRequest('Choose who can view this paper.', 'INVALID_ACCESS');
    fields.viewAccess = body.viewAccess;
  }
  if (has('downloadAccess')) {
    if (!PAPER_DOWNLOAD_ACCESS.includes(body.downloadAccess))
      throw badRequest('Choose who can download this paper.', 'INVALID_ACCESS');
    fields.downloadAccess = body.downloadAccess;
  }
  if (has('showOnProfile')) fields.showOnProfile = parseBool(body.showOnProfile);
  return fields;
}

async function loadOwnPaper(id, userId) {
  if (!isValidId(id)) throw notFound('Paper not found.');
  const paper = await Paper.findById(id);
  if (!paper) throw notFound('Paper not found.');
  if (String(paper.owner) !== String(userId)) throw forbidden('Only the author can change this paper.');
  return paper;
}

router.get('/mine', requireAuth, async (req, res) => {
  const papers = await Paper.find({ owner: req.userId }).sort({ order: 1, createdAt: -1 }).lean();
  res.json({ papers: papers.map((p) => paperSummary(p, 'self')) });
});

router.post('/', requireAuth, uploadPaperFile, async (req, res) => {
  const body = req.body || {};
  const kind = body.kind === 'link' ? 'link' : 'file';
  const fields = readPaperFields(body);
  if (kind === 'link' && fields.downloadAccess === 'paid') {
    throw badRequest('Paid access is available only for uploaded paper files.', 'PAID_LINK_UNSUPPORTED');
  }

  if (kind === 'file') {
    if (!req.file) throw badRequest('Attach the paper as a PDF or Word file.', 'NO_FILE');
  } else {
    let link = normalizeUrl(body.link);
    if (!link && fields.doi) link = `https://doi.org/${fields.doi}`;
    if (!link) throw badRequest('Add a DOI, arXiv or journal link to the paper.', 'INVALID_LINK');
    fields.link = link;
  }

  const last = await Paper.findOne({ owner: req.userId }).sort({ order: -1 }).select('order').lean();
  const paper = new Paper({ ...fields, owner: req.userId, kind, order: last ? last.order + 1 : 0 });

  if (kind === 'file') {
    const fileId = await saveFile({
      buffer: req.file.buffer,
      filename: req.file.originalname || `${fields.title}.pdf`,
      mime: req.file.mimetype,
      kind: 'paper',
      owner: req.userId,
      access: 'private',
    });
    paper.file = { id: fileId, name: req.file.originalname || 'paper', mime: req.file.mimetype, size: req.file.size };
  }
  await paper.save();
  res.status(201).json({ paper: paperSummary(paper.toObject(), 'self') });
});

/** Saves the author's order and which papers appear in the profile index. */
router.put('/order', requireAuth, async (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(String).filter(isValidId) : [];
  const visible = Array.isArray(req.body?.visibleIds) ? new Set(req.body.visibleIds.map(String)) : null;
  if (!ids.length) throw badRequest('Send the papers in their new order.', 'INVALID_ORDER');
  const owned = await Paper.find({ owner: req.userId, _id: { $in: ids } })
    .select('_id')
    .lean();
  const ownedSet = new Set(owned.map((p) => String(p._id)));
  const ops = ids
    .filter((id) => ownedSet.has(id))
    .map((id, index) => ({
      updateOne: {
        filter: { _id: id, owner: req.userId },
        update: { $set: { order: index, ...(visible ? { showOnProfile: visible.has(id) } : {}) } },
      },
    }));
  if (ops.length) await Paper.bulkWrite(ops);
  const papers = await Paper.find({ owner: req.userId }).sort({ order: 1, createdAt: -1 }).lean();
  res.json({ papers: papers.map((p) => paperSummary(p, 'self')) });
});

router.get('/:id', optionalAuth, async (req, res) => {
  if (!isValidId(req.params.id)) throw notFound('Paper not found.');
  const paper = await Paper.findById(req.params.id).populate('owner', SUMMARY_FIELDS).lean();
  if (!paper) throw notFound('Paper not found.');
  const { status } = await getRelation(req.userId, paper.owner._id);
  if (!canViewPaper(paper, status)) {
    throw new HttpError(
      403,
      paper.viewAccess === 'private'
        ? 'This paper is private.'
        : `Only ${paper.owner.name.split(' ')[0]}'s connections can view this paper.`,
      'PAPER_LOCKED',
      { owner: userSummary(paper.owner), viewAccess: paper.viewAccess },
    );
  }
  if (status !== 'self') await Paper.updateOne({ _id: paper._id }, { $inc: { 'stats.views': 1 } });
  res.json({
    paper: paperDetail(paper, status),
    relation: status,
    downloadNote: canDownloadPaper(paper, status) ? '' : downloadBlockReason(paper, status),
  });
});

router.patch('/:id', requireAuth, uploadPaperFile, async (req, res) => {
  const paper = await loadOwnPaper(req.params.id, req.userId);
  const fields = readPaperFields(req.body || {}, { partial: true });
  if (paper.kind === 'link' && fields.downloadAccess === 'paid') {
    throw badRequest('Paid access is available only for uploaded paper files.', 'PAID_LINK_UNSUPPORTED');
  }
  if (paper.kind === 'link' && req.body?.link !== undefined) {
    const link = normalizeUrl(req.body.link);
    if (!link) throw badRequest('Enter a valid DOI, arXiv or journal link.', 'INVALID_LINK');
    fields.link = link;
  }
  Object.assign(paper, fields);
  if (req.file && paper.kind === 'file') {
    const oldId = paper.file?.id;
    const fileId = await saveFile({
      buffer: req.file.buffer,
      filename: req.file.originalname || 'paper',
      mime: req.file.mimetype,
      kind: 'paper',
      owner: req.userId,
      access: 'private',
    });
    paper.file = { id: fileId, name: req.file.originalname || 'paper', mime: req.file.mimetype, size: req.file.size };
    if (oldId) await deleteFile(oldId);
  }
  await paper.save();
  res.json({ paper: paperSummary(paper.toObject(), 'self') });
});

router.delete('/:id', requireAuth, async (req, res) => {
  const paper = await loadOwnPaper(req.params.id, req.userId);
  if (paper.file?.id) await deleteFile(paper.file.id);
  await Promise.all([
    PaperDownload.deleteMany({ paper: paper._id }),
    Notification.deleteMany({ paper: paper._id }),
    Post.updateMany({ paper: paper._id }, { $set: { paper: null } }),
    paper.deleteOne(),
  ]);
  pushCounts(req.userId);
  res.json({ ok: true });
});

/**
 * Download (or open the external link of) a paper. Access is checked against the author's
 * download setting and the viewer's connection status. The author is notified in real time.
 */
router.post('/:id/download', requireAuth, async (req, res) => {
  if (!isValidId(req.params.id)) throw notFound('Paper not found.');
  const paper = await Paper.findById(req.params.id).lean();
  if (!paper) throw notFound('Paper not found.');
  const { status } = await getRelation(req.userId, paper.owner);
  if (!canDownloadPaper(paper, status)) {
    throw forbidden(downloadBlockReason(paper, status), 'DOWNLOAD_BLOCKED');
  }

  const isOwner = status === 'self';
  if (!isOwner) {
    const recent = await PaperDownload.exists({
      paper: paper._id,
      user: req.userId,
      createdAt: { $gte: new Date(Date.now() - 10 * 60 * 1000) },
    });
    await PaperDownload.create({ paper: paper._id, owner: paper.owner, user: req.userId, kind: paper.kind });
    await Paper.updateOne({ _id: paper._id }, { $inc: { 'stats.downloads': 1 } });
    // One alert per person per paper every 10 minutes keeps notifications meaningful.
    if (!recent) {
      await notify({
        recipient: paper.owner,
        actor: req.userId,
        type: 'paper_download',
        paper: paper._id,
        snippet: paper.kind === 'link' ? 'link' : 'file',
      });
    }
  }

  if (paper.kind === 'link') return res.json({ kind: 'link', url: paper.link });
  res.json({
    kind: 'file',
    url: signedFileUrl(paper.file.id, { ttlSeconds: 15 * 60, download: true, name: paper.file.name, exactExpiry: true }),
    viewUrl: signedFileUrl(paper.file.id, { ttlSeconds: 15 * 60, name: paper.file.name, exactExpiry: true }),
    filename: paper.file.name,
    mime: paper.file.mime,
  });
});

/** The author's list of people who downloaded a paper. */
router.get('/:id/downloads', requireAuth, async (req, res) => {
  const paper = await loadOwnPaper(req.params.id, req.userId);
  const rows = await PaperDownload.find({ paper: paper._id })
    .sort({ createdAt: -1 })
    .limit(100)
    .populate('user', SUMMARY_FIELDS)
    .lean();
  res.json({
    total: paper.stats?.downloads || 0,
    results: rows
      .filter((r) => r.user)
      .map((r) => ({ id: String(r._id), user: userSummary(r.user), kind: r.kind, at: r.createdAt })),
  });
});

export default router;
