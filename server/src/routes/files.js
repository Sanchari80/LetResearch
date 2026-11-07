import { Router } from 'express';
import { findFile, streamFile, verifySignedRequest } from '../services/files.js';
import { forbidden, notFound } from '../utils/http.js';

const router = Router();

/**
 * Serves uploaded files. Public files (avatars, covers, public post media) are served by id.
 * Private files (papers, chat attachments, connections-only media) need a valid signed URL.
 */
router.get('/:id', async (req, res) => {
  const file = await findFile(req.params.id);
  if (!file) throw notFound('File not found.');
  const isPublic = file.metadata?.access === 'public';
  const signed = verifySignedRequest(req.params.id, req.query);
  if (!isPublic && !signed) throw forbidden('This link has expired or is not valid.', 'LINK_EXPIRED');
  streamFile(req, res, file, {
    download: signed && req.query.dl === '1',
    filename: typeof req.query.name === 'string' ? req.query.name : undefined,
  });
});

export default router;
