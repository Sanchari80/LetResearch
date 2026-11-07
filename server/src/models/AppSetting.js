import mongoose from 'mongoose';

const { Schema } = mongoose;

/** Small server-wide values that must survive restarts (e.g. generated web push keys). */
const appSettingSchema = new Schema(
  {
    key: { type: String, required: true, unique: true },
    value: { type: Schema.Types.Mixed, default: null },
  },
  { timestamps: true },
);

export const AppSetting = mongoose.model('AppSetting', appSettingSchema);
