import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * A one-to-one conversation.
 * - active:   both people can chat (they are connected, or the request was accepted).
 * - request:  a message request from someone who is not connected. It lives in the
 *             recipient's "Message requests" tab until they accept it.
 * - declined: the recipient declined. The sender still sees a pending request.
 */
const conversationSchema = new Schema(
  {
    participants: [{ type: Schema.Types.ObjectId, ref: 'User', required: true }],
    pairKey: { type: String, required: true, unique: true },
    status: { type: String, enum: ['active', 'request', 'declined'], default: 'active', index: true },
    requestedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    acceptedAt: { type: Date, default: null },
    lastMessage: {
      text: { type: String, default: '' },
      kind: { type: String, default: 'text' },
      sender: { type: Schema.Types.ObjectId, ref: 'User', default: null },
      createdAt: { type: Date, default: null },
    },
    lastMessageAt: { type: Date, default: null, index: true },
    unread: { type: Map, of: Number, default: () => new Map() },
  },
  { timestamps: true },
);

conversationSchema.index({ participants: 1, lastMessageAt: -1 });

export const Conversation = mongoose.model('Conversation', conversationSchema);

const messageSchema = new Schema(
  {
    conversation: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true, index: true },
    sender: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, default: '', maxlength: 4000 },
    kind: { type: String, enum: ['text', 'image', 'file'], default: 'text' },
    attachment: {
      id: { type: Schema.Types.ObjectId, default: null },
      name: { type: String, default: '' },
      mime: { type: String, default: '' },
      size: { type: Number, default: 0 },
    },
    readAt: { type: Date, default: null },
  },
  { timestamps: true },
);

messageSchema.index({ conversation: 1, createdAt: -1 });

export const Message = mongoose.model('Message', messageSchema);
