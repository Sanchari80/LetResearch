import mongoose from 'mongoose';
import { PAPER_DOWNLOAD_ACCESS, PAPER_VIEW_ACCESS } from '../constants.js';

const { Schema } = mongoose;

const paperSchema = new Schema(
  {
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 300 },
    abstract: { type: String, default: '', maxlength: 6000 },
    authors: { type: [String], default: [] },
    venue: { type: String, default: '', maxlength: 200 },
    year: { type: Number, default: null },
    doi: { type: String, default: '', maxlength: 200 },
    keywords: { type: [String], default: [] },
    // "file" = uploaded PDF/DOCX, "link" = external DOI / arXiv / journal link.
    kind: { type: String, enum: ['file', 'link'], required: true },
    link: { type: String, default: '' },
    file: {
      id: { type: Schema.Types.ObjectId, default: null },
      name: { type: String, default: '' },
      mime: { type: String, default: '' },
      size: { type: Number, default: 0 },
    },
    viewAccess: { type: String, enum: PAPER_VIEW_ACCESS, default: 'public' },
    downloadAccess: { type: String, enum: PAPER_DOWNLOAD_ACCESS, default: 'everyone' },
    // The author decides which papers appear in their profile index and in which order.
    showOnProfile: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
    stats: {
      views: { type: Number, default: 0 },
      downloads: { type: Number, default: 0 },
    },
  },
  { timestamps: true },
);

paperSchema.index({ owner: 1, order: 1 });

export const Paper = mongoose.model('Paper', paperSchema);

const paperDownloadSchema = new Schema(
  {
    paper: { type: Schema.Types.ObjectId, ref: 'Paper', required: true, index: true },
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    kind: { type: String, enum: ['file', 'link'], default: 'file' },
  },
  { timestamps: true },
);

paperDownloadSchema.index({ paper: 1, user: 1, createdAt: -1 });

export const PaperDownload = mongoose.model('PaperDownload', paperDownloadSchema);
