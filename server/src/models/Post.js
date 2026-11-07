import mongoose from 'mongoose';
import { POST_CATEGORIES, POST_KINDS } from '../constants.js';

const { Schema } = mongoose;

const postSchema = new Schema(
  {
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    kind: { type: String, enum: POST_KINDS, required: true },
    text: { type: String, default: '', maxlength: 3000 },
    category: { type: String, enum: POST_CATEGORIES, required: true },
    audience: { type: String, enum: ['public', 'connections'], default: 'public' },
    link: {
      url: { type: String, default: '' },
      domain: { type: String, default: '' },
    },
    paper: { type: Schema.Types.ObjectId, ref: 'Paper', default: null },
    media: [
      {
        _id: false,
        id: { type: Schema.Types.ObjectId, required: true },
        kind: { type: String, enum: ['image', 'video'], required: true },
        mime: { type: String, default: '' },
        // Media of connections-only posts is private and served through signed URLs.
        access: { type: String, enum: ['public', 'private'], default: 'public' },
      },
    ],
    likes: { type: [Schema.Types.ObjectId], default: [], select: false },
    likeCount: { type: Number, default: 0 },
    commentCount: { type: Number, default: 0 },
    reports: {
      type: [
        {
          _id: false,
          user: { type: Schema.Types.ObjectId, ref: 'User' },
          reason: { type: String, maxlength: 300 },
          at: { type: Date, default: Date.now },
        },
      ],
      default: [],
      select: false,
    },
    moderation: {
      // approved = visible, flagged = hidden pending review, removed = taken down by a moderator.
      status: { type: String, enum: ['approved', 'flagged', 'removed'], default: 'approved', index: true },
      checks: { type: [String], default: [] },
      reviewedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
      reviewedAt: { type: Date, default: null },
    },
  },
  { timestamps: true },
);

postSchema.index({ createdAt: -1 });
postSchema.index({ 'moderation.status': 1, createdAt: -1 });

export const Post = mongoose.model('Post', postSchema);

const commentSchema = new Schema(
  {
    post: { type: Schema.Types.ObjectId, ref: 'Post', required: true, index: true },
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, required: true, maxlength: 1500 },
  },
  { timestamps: true },
);

export const Comment = mongoose.model('Comment', commentSchema);
