// File storage on MongoDB GridFS. Every upload (avatars, covers, post media, papers and chat
// attachments) lives in the "uploads" bucket, so a single MongoDB Atlas database is all the
// storage the app needs – no separate disk is required on Render.
import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { config } from '../config.js';
import { getBucket, isValidId, toObjectId } from '../db.js';

const DAY = 24 * 60 * 60;

function hmac(value) {
  return crypto.createHmac('sha256', config.fileUrlSecret).update(value).digest('base64url');
}

function safeName(name) {
  const cleaned = String(name || 'file')
    .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '_')
    .trim();
  return cleaned.slice(0, 150) || 'file';
}

/**
 * Stores a buffer in GridFS and returns the new file id.
 * access = "public"  → readable by URL (avatars, covers, approved post media).
 * access = "private" → readable only with a signed URL (papers, chat attachments).
 */
export async function saveFile({ buffer, filename, mime, kind, owner, access = 'public' }) {
  const bucket = getBucket();
  const id = new mongoose.Types.ObjectId();
  await new Promise((resolve, reject) => {
    const upload = bucket.openUploadStreamWithId(id, safeName(filename), {
      metadata: { mime: mime || 'application/octet-stream', kind, owner: owner ? toObjectId(owner) : null, access },
    });
    upload.once('error', reject);
    upload.once('finish', resolve);
    upload.end(buffer);
  });
  return id;
}

export async function findFile(id) {
  if (!isValidId(String(id))) return null;
  const docs = await getBucket()
    .find({ _id: toObjectId(id) })
    .limit(1)
    .toArray();
  return docs[0] || null;
}

export async function deleteFile(id) {
  if (!id) return;
  try {
    await getBucket().delete(toObjectId(id));
  } catch {
    // Already removed – nothing to do.
  }
}

export function publicFileUrl(id) {
  return id ? `/api/files/${id}` : null;
}

/**
 * Creates a signed, expiring URL for a private file. Expiry is rounded up to the next
 * day boundary so the same URL is reused (and cached by the app) for a while.
 */
export function signedFileUrl(id, { ttlSeconds = 7 * DAY, download = false, name, exactExpiry = false } = {}) {
  if (!id) return null;
  const now = Math.floor(Date.now() / 1000);
  const exp = exactExpiry ? now + ttlSeconds : Math.ceil((now + ttlSeconds) / DAY) * DAY;
  const dl = download ? '1' : '0';
  const params = new URLSearchParams({ exp: String(exp), sig: hmac(`${id}.${exp}.${dl}`) });
  if (download) params.set('dl', '1');
  if (name) params.set('name', safeName(name));
  return `/api/files/${id}?${params.toString()}`;
}

export function verifySignedRequest(id, query) {
  const exp = Number(query.exp);
  const sig = String(query.sig || '');
  const dl = query.dl === '1' ? '1' : '0';
  if (!exp || !sig || exp < Math.floor(Date.now() / 1000)) return false;
  const expected = hmac(`${id}.${exp}.${dl}`);
  const a = Buffer.from(expected);
  const b = Buffer.from(sig);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Streams a GridFS file with HTTP range support (needed for video playback on iOS/Safari). */
export function streamFile(req, res, fileDoc, { download = false, filename } = {}) {
  const bucket = getBucket();
  const total = fileDoc.length;
  const mime = fileDoc.metadata?.mime || 'application/octet-stream';
  const name = safeName(filename || fileDoc.filename);

  res.setHeader('Content-Type', mime);
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader(
    'Content-Disposition',
    `${download ? 'attachment' : 'inline'}; filename="${name.replace(/[^\x20-\x7e]/g, '_')}"; filename*=UTF-8''${encodeURIComponent(name)}`,
  );
  res.setHeader(
    'Cache-Control',
    fileDoc.metadata?.access === 'public' ? 'public, max-age=31536000, immutable' : 'private, max-age=3600',
  );

  let start = 0;
  let end = total - 1;
  const range = req.headers.range;
  if (range && total > 0) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(String(range).trim());
    if (match) {
      if (match[1] === '' && match[2] !== '') {
        start = Math.max(total - Number(match[2]), 0);
      } else {
        start = Number(match[1] || 0);
        if (match[2] !== '') end = Math.min(Number(match[2]), total - 1);
      }
      if (start > end || start >= total) {
        res.status(416).setHeader('Content-Range', `bytes */${total}`);
        return res.end();
      }
      res.status(206);
      res.setHeader('Content-Range', `bytes ${start}-${end}/${total}`);
    }
  }
  res.setHeader('Content-Length', total === 0 ? 0 : end - start + 1);
  if (req.method === 'HEAD' || total === 0) return res.end();

  const stream = bucket.openDownloadStream(fileDoc._id, { start, end: end + 1 });
  stream.on('error', () => {
    if (!res.headersSent) res.status(404);
    res.end();
  });
  // If the client goes away (e.g. a video seek), stop reading from the database.
  res.on('close', () => {
    if (!stream.destroyed) stream.destroy();
  });
  stream.pipe(res);
}
