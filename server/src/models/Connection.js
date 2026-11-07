import mongoose from 'mongoose';

const { Schema } = mongoose;

/** A connection request between two researchers. Declined or withdrawn requests are deleted. */
const connectionSchema = new Schema(
  {
    requester: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    recipient: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    // Sorted "idA_idB" key so a pair can only have one connection document.
    pairKey: { type: String, required: true, unique: true },
    status: { type: String, enum: ['pending', 'accepted'], default: 'pending', index: true },
    respondedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export function pairKeyOf(a, b) {
  return [String(a), String(b)].sort().join('_');
}

export const Connection = mongoose.model('Connection', connectionSchema);
