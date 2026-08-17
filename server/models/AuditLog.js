import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema({
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  action: { type: String, required: true, trim: true, index: true },
  entityType: { type: String, required: true, trim: true, index: true },
  entityId: { type: String, default: '', trim: true, index: true },
  summary: { type: String, required: true, trim: true, maxlength: 500 },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  ip: { type: String, default: '' },
  userAgent: { type: String, default: '', maxlength: 500 },
}, { timestamps: true });

auditLogSchema.index({ createdAt: -1 });

export const AuditLog = mongoose.models.AuditLog || mongoose.model('AuditLog', auditLogSchema);

export async function writeAudit(req, { action, entityType, entityId = '', summary, metadata = {} }) {
  try {
    await AuditLog.create({
      actorId: req.user?.id || null,
      action,
      entityType,
      entityId: String(entityId || ''),
      summary,
      metadata,
      ip: req.ip || '',
      userAgent: req.get?.('user-agent') || '',
    });
  } catch (error) {
    console.error('Audit log write failed:', error.message);
  }
}
