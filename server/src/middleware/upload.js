import multer from 'multer';
import { config } from '../config.js';
import { badRequest } from '../utils/http.js';

const storage = multer.memoryStorage();

const PAPER_TYPES = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/msword': 'doc',
};

/** Some phones report DOCX/PDF files as octet-stream, so fall back to the file extension. */
export function resolvePaperMime(file) {
  if (PAPER_TYPES[file.mimetype]) return file.mimetype;
  const name = String(file.originalname || '').toLowerCase();
  if (name.endsWith('.pdf')) return 'application/pdf';
  if (name.endsWith('.docx')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (name.endsWith('.doc')) return 'application/msword';
  return null;
}

const IMAGE_EXT = /\.(jpe?g|png|webp|heic|heif)$/i;

export function resolveImageMime(file) {
  if (/^image\/(jpeg|jpg|png|webp|heic|heif)$/.test(file.mimetype))
    return file.mimetype === 'image/jpg' ? 'image/jpeg' : file.mimetype;
  const match = String(file.originalname || '').match(IMAGE_EXT);
  if (!match) return null;
  const ext = match[1].toLowerCase();
  return { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', heic: 'image/heic', heif: 'image/heif' }[
    ext
  ];
}

export const uploadImage = multer({
  storage,
  limits: { fileSize: config.limits.imageBytes, files: 1 },
  fileFilter: (_req, file, cb) => {
    const mime = resolveImageMime(file);
    if (!mime) return cb(badRequest('Choose a JPG, PNG, WEBP or HEIC image.', 'INVALID_FILE'));
    file.mimetype = mime;
    cb(null, true);
  },
}).single('file');

export const uploadPaperFile = multer({
  storage,
  limits: { fileSize: config.limits.paperBytes, files: 1 },
  fileFilter: (_req, file, cb) => {
    const mime = resolvePaperMime(file);
    if (!mime) return cb(badRequest('Research papers must be PDF or Word (DOC/DOCX) files.', 'INVALID_FILE'));
    file.mimetype = mime;
    cb(null, true);
  },
}).single('file');

export const uploadPostMedia = multer({
  storage,
  limits: { fileSize: Math.max(config.limits.videoBytes, config.limits.imageBytes), files: 4 },
}).array('media', 4);

export const uploadChatFile = multer({
  storage,
  limits: { fileSize: config.limits.chatFileBytes, files: 1 },
}).single('file');
