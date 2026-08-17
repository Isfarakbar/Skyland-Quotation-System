import mongoose from 'mongoose';

const sessionSchema = new mongoose.Schema({
  tokenHash: { type: String, required: true, unique: true, select: false },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
  lastSeenAt: { type: Date, default: Date.now },
  ip: { type: String, default: '' },
  userAgent: { type: String, default: '', maxlength: 500 },
}, { timestamps: true });

sessionSchema.index({ userId: 1, createdAt: -1 });

export const Session = mongoose.models.Session || mongoose.model('Session', sessionSchema);
