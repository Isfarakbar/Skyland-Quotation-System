import express from 'express';
import { AuditLog } from '../models/AuditLog.js';
import { allowPermission } from '../middleware/auth.js';
import { pagination, paginated } from '../lib/api.js';

const router = express.Router();

router.get('/', allowPermission('audit_view'), async (req, res) => {
  const { page, limit, skip } = pagination(req.query, { defaultLimit: 30, max: 100 });
  const filter = {};
  if (req.query.entityType) filter.entityType = String(req.query.entityType);
  if (req.query.action) filter.action = String(req.query.action);
  const [items, total] = await Promise.all([
    AuditLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('actorId', 'firstName lastName email').lean(),
    AuditLog.countDocuments(filter),
  ]);
  res.json(paginated(items.map(item => ({ ...item, id: item._id.toString(), _id: undefined })), total, page, limit));
});

export default router;
