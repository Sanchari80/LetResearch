import mongoose from 'mongoose';
import { DEFAULT_VISIBILITY, VISIBILITY } from '../constants.js';

const { Schema } = mongoose;

const visibilityField = (defaultValue) => ({ type: String, enum: VISIBILITY, default: defaultValue });

const visibilitySchema = new Schema(
  Object.fromEntries(Object.entries(DEFAULT_VISIBILITY).map(([key, value]) => [key, visibilityField(value)])),
  { _id: false },
);

const pushSubscriptionSchema = new Schema(
  {
    endpoint: { type: String, required: true, maxlength: 1000 },
    keys: {
      p256dh: { type: String, required: true, maxlength: 200 },
      auth: { type: String, required: true, maxlength: 100 },
    },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    username: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 40 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 160 },
    passwordHash: { type: String, required: true, select: false },
    headline: { type: String, default: '', maxlength: 140 },
    avatar: { type: Schema.Types.ObjectId, default: null },
    cover: { type: Schema.Types.ObjectId, default: null },
    profile: {
      qualification: { type: String, default: '', maxlength: 140 },
      institution: { type: String, default: '', maxlength: 140 },
      location: { type: String, default: '', maxlength: 120 },
      bio: { type: String, default: '', maxlength: 1200 },
      interests: { type: [String], default: [] },
    },
    links: {
      email: { type: String, default: '', maxlength: 160 },
      phone: { type: String, default: '', maxlength: 40 },
      whatsapp: { type: String, default: '', maxlength: 40 },
      linkedin: { type: String, default: '', maxlength: 300 },
      github: { type: String, default: '', maxlength: 300 },
      portfolio: { type: String, default: '', maxlength: 300 },
      researchgate: { type: String, default: '', maxlength: 300 },
      scholar: { type: String, default: '', maxlength: 300 },
      orcid: { type: String, default: '', maxlength: 300 },
      telegram: { type: String, default: '', maxlength: 120 },
      twitter: { type: String, default: '', maxlength: 120 },
    },
    visibility: { type: visibilitySchema, default: () => ({}) },
    openToCollaborate: { type: Boolean, default: false },
    settings: {
      // Who can send a direct message request without being connected.
      messageRequests: { type: String, enum: ['everyone', 'none'], default: 'everyone' },
    },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    lastSeenAt: { type: Date, default: Date.now },
    // Browsers that asked for notifications while LetResearch is closed (web push).
    pushSubscriptions: { type: [pushSubscriptionSchema], default: [], select: false },
  },
  { timestamps: true },
);

userSchema.index({ name: 'text', headline: 'text' });
userSchema.index({ 'profile.interests': 1 });

export const User = mongoose.model('User', userSchema);
