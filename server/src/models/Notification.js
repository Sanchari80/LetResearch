import mongoose from 'mongoose';
import { NOTIFICATION_TYPES } from '../constants.js';

const { Schema } = mongoose;

const notificationSchema = new Schema(
  {
    recipient: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    actor: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    type: { type: String, enum: NOTIFICATION_TYPES, required: true },
    post: { type: Schema.Types.ObjectId, ref: 'Post', default: null },
    paper: { type: Schema.Types.ObjectId, ref: 'Paper', default: null },
    conversation: { type: Schema.Types.ObjectId, ref: 'Conversation', default: null },
    connection: { type: Schema.Types.ObjectId, ref: 'Connection', default: null },
    // Optional extra context, e.g. a comment preview or a moderation reason.
    snippet: { type: String, default: '', maxlength: 200 },
    read: { type: Boolean, default: false, index: true },
  },
  { timestamps: true },
);

notificationSchema.index({ recipient: 1, createdAt: -1 });

export const Notification = mongoose.model('Notification', notificationSchema);
