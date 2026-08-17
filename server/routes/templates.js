import express from 'express';
import { QuotationTemplate } from '../models/QuotationTemplate.js';
import { allowPermission } from '../middleware/auth.js';
import { writeAudit } from '../models/AuditLog.js';

const router = express.Router();

router.get('/', async (_req, res) => res.json(await QuotationTemplate.find({ active: true }).sort({ name: 1 }).lean()));

router.post('/', allowPermission('products_manage'), async (req, res) => {
  const template = await QuotationTemplate.create({ ...req.body, createdBy: req.user.id, updatedBy: req.user.id });
  await writeAudit(req, { action: 'template.created', entityType: 'quotation_template', entityId: template.id, summary: `Created template ${template.name}` });
  res.status(201).json(template);
});

router.put('/:id', allowPermission('products_manage'), async (req, res) => {
  const template = await QuotationTemplate.findByIdAndUpdate(req.params.id, { ...req.body, updatedBy: req.user.id }, { returnDocument: 'after', runValidators: true });
  if (!template) return res.status(404).json({ error: { code: 'TEMPLATE_NOT_FOUND', message: 'Quotation template not found' } });
  await writeAudit(req, { action: 'template.updated', entityType: 'quotation_template', entityId: template.id, summary: `Updated template ${template.name}` });
  res.json(template);
});

router.delete('/:id', allowPermission('products_delete'), async (req, res) => {
  const template = await QuotationTemplate.findByIdAndUpdate(req.params.id, { active: false, updatedBy: req.user.id }, { returnDocument: 'after' });
  if (!template) return res.status(404).json({ error: { code: 'TEMPLATE_NOT_FOUND', message: 'Quotation template not found' } });
  await writeAudit(req, { action: 'template.archived', entityType: 'quotation_template', entityId: template.id, summary: `Archived template ${template.name}` });
  res.status(204).end();
});

export default router;
