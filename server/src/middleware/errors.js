import multer from 'multer';
import mongoose from 'mongoose';
import { HttpError } from '../utils/http.js';

export function notFoundHandler(req, res) {
  res.status(404).json({ error: { message: `No route for ${req.method} ${req.path}`, code: 'NOT_FOUND' } });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, _req, res, _next) {
  if (res.headersSent) return;
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: { message: err.message, code: err.code, details: err.details } });
  }
  if (err instanceof multer.MulterError) {
    const message =
      err.code === 'LIMIT_FILE_SIZE'
        ? 'That file is too large.'
        : err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE'
          ? 'Too many files attached.'
          : 'The upload could not be processed.';
    return res.status(err.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ error: { message, code: err.code } });
  }
  if (err instanceof mongoose.Error.ValidationError) {
    const first = Object.values(err.errors)[0];
    return res.status(400).json({ error: { message: first?.message || 'Invalid data.', code: 'VALIDATION' } });
  }
  if (err instanceof mongoose.Error.CastError) {
    return res.status(400).json({ error: { message: 'Invalid id.', code: 'INVALID_ID' } });
  }
  if (err?.code === 11000) {
    return res.status(409).json({ error: { message: 'This already exists.', code: 'DUPLICATE' } });
  }
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ error: { message: 'Request is too large.', code: 'TOO_LARGE' } });
  }
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: { message: 'Malformed JSON body.', code: 'BAD_JSON' } });
  }
  console.error('[error]', err);
  res.status(500).json({ error: { message: 'Something went wrong on the server. Please try again.', code: 'SERVER_ERROR' } });
}
