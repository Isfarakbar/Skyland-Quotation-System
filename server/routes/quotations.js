import express from 'express';
import { Quotation } from '../models/Quotation.js';
import { Customer } from '../models/Customer.js';
import { hasPermission } from '../middleware/auth.js';
import { pagination, paginated } from '../lib/api.js';
import { writeAudit } from '../models/AuditLog.js';

const router = express.Router();
const fail = (res, status, code, message) => res.status(status).json({ error: { code, message } });
const statuses = ['draft', 'pending_approval', 'approved', 'sent', 'viewed', 'accepted', 'rejected', 'expired', 'cancelled'];
const transitions = {
  draft: ['pending_approval', 'approved', 'sent', 'cancelled'], pending_approval: ['approved', 'rejected', 'cancelled'],
  approved: ['sent', 'cancelled'], sent: ['viewed', 'accepted', 'rejected', 'expired', 'cancelled'],
  viewed: ['accepted', 'rejected', 'expired', 'cancelled'], accepted: ['cancelled'], rejected: ['draft'], expired: ['draft'], cancelled: [],
};
const ownFilter = user => hasPermission(user, 'quotations_view_all')
  ? {}
  : { $or: [{ createdBy: user.id }, { assignedTo: user.id }] };
const owns = (user, quote) => [quote.createdBy, quote.assignedTo].some(value => value?.toString() === user.id);
const canEdit = (user, quote) => hasPermission(user, 'quotations_manage_all') || owns(user, quote);

function validateCommercialTerms(body) {
  const taxRate = Number(body.taxRate || 0);
  if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100) return 'Tax rate must be between 0 and 100%';
  const schedule = Array.isArray(body.paymentSchedule) ? body.paymentSchedule : [];
  if (schedule.length) {
    const total = schedule.reduce((sum, milestone) => sum + Number(milestone.percent || 0), 0);
    if (schedule.some(milestone => !String(milestone.label || '').trim()) || Math.abs(total - 100) > 0.01) return 'Payment milestones must have labels and total exactly 100%';
  }
  if (body.prosumerIncluded && Number(body.sanctionedLoad || 0) > 0 && Number(body.systemSize || 0) > Number(body.sanctionedLoad)) return 'For a prosumer application, proposed generation capacity cannot exceed the sanctioned load';
  return null;
}

function calculateTotals(source) {
  const items = (source.items || []).filter(item => Number(item.quantity) > 0 && String(item.name || '').trim())
    .map(item => ({ ...item, quantity: Number(item.quantity), unitPrice: Number(item.unitPrice || 0), total: Number(item.quantity) * Number(item.unitPrice || 0) }));
  const subtotal = items.reduce((sum, item) => sum + item.total, 0);
  const discount = Number(source.discount || 0);
  const discountAmount = source.discountType === 'fixed' ? discount : subtotal * (discount / 100);
  const taxableAmount = Math.max(0, subtotal - discountAmount);
  const taxAmount = taxableAmount * (Number(source.taxRate || 0) / 100);
  return { items, subtotal, taxAmount, grandTotal: taxableAmount + taxAmount };
}

async function customerAllowed(user, customerId) {
  const access = hasPermission(user, 'customers_view_all') ? {} : { $or: [{ createdBy: user.id }, { assignedTo: user.id }] };
  return Customer.exists({ _id: customerId, ...access });
}

router.get('/', async (req, res) => {
  const baseAccess = ownFilter(req.user);
  const filters = [baseAccess];
  if (req.query.status && statuses.includes(req.query.status)) filters.push({ status: req.query.status });
  if (req.query.owner) filters.push({ assignedTo: req.query.owner });
  if (req.query.from || req.query.to) filters.push({ createdAt: { ...(req.query.from ? { $gte: new Date(req.query.from) } : {}), ...(req.query.to ? { $lte: new Date(req.query.to) } : {}) } });
  if (req.query.min || req.query.max) filters.push({ grandTotal: { ...(req.query.min ? { $gte: Number(req.query.min) } : {}), ...(req.query.max ? { $lte: Number(req.query.max) } : {}) } });
  if (req.query.search) {
    const search = String(req.query.search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filters.push({ quotationNumber: { $regex: search, $options: 'i' } });
  }
  const filter = filters.length === 1 ? filters[0] : { $and: filters };
  const sort = req.query.sort === 'amount_desc' ? { grandTotal: -1 } : req.query.sort === 'amount_asc' ? { grandTotal: 1 } : { createdAt: -1 };
  if (!req.query.page && Object.keys(req.query).length === 0) return res.json(await Quotation.find(filter).sort(sort));
  const { page, limit, skip } = pagination(req.query);
  const [items, total] = await Promise.all([Quotation.find(filter).sort(sort).skip(skip).limit(limit).lean(), Quotation.countDocuments(filter)]);
  res.json(paginated(items.map(item => ({ ...item, id: item._id.toString() })), total, page, limit));
});

router.get('/export/csv', async (req, res) => {
  if (!hasPermission(req.user, 'exports_manage')) return fail(res, 403, 'FORBIDDEN', 'Export access is required');
  const rows = await Quotation.find(ownFilter(req.user)).sort({ createdAt: -1 }).limit(5000).lean();
  const escape = value => `"${String(value ?? '').replaceAll('"', '""')}"`;
  const csv = ['Reference,Status,System kW,Total,Created', ...rows.map(row => [row.quotationNumber, row.status, row.systemSize, row.grandTotal, row.createdAt.toISOString()].map(escape).join(','))].join('\n');
  await writeAudit(req, { action: 'quotation.exported', entityType: 'quotation', summary: `Exported ${rows.length} quotations` });
  res.type('text/csv').attachment('skyland-quotations.csv').send(csv);
});

router.get('/:id', async (req, res) => {
  const quotation = await Quotation.findOne({ _id: req.params.id, ...ownFilter(req.user) });
  if (!quotation) return fail(res, 404, 'QUOTATION_NOT_FOUND', 'Quotation not found');
  res.json(quotation);
});

router.post('/', async (req, res) => {
  if (!(await customerAllowed(req.user, req.body.customerId))) return fail(res, 400, 'CUSTOMER_INVALID', 'Select a customer assigned to you');
  const commercialError = validateCommercialTerms(req.body);
  if (commercialError) return fail(res, 400, 'COMMERCIAL_INVALID', commercialError);
  const totals = calculateTotals(req.body);
  if (!totals.items.length || totals.subtotal <= 0) return fail(res, 400, 'ITEMS_REQUIRED', 'Add at least one priced line item before saving');
  const discount = Number(req.body.discount || 0);
  if (req.body.discountType === 'percent' && discount > 100) return fail(res, 400, 'DISCOUNT_INVALID', 'Percentage discount cannot exceed 100%');
  const status = statuses.includes(req.body.status) ? req.body.status : 'draft';
  const quotation = await Quotation.create({
    ...req.body, ...totals, status, assignedTo: req.body.assignedTo || req.user.id,
    createdBy: req.user.id, updatedBy: req.user.id,
    commercialSnapshot: { items: totals.items, subtotal: totals.subtotal, discount, discountType: req.body.discountType || 'percent', taxRate: Number(req.body.taxRate || 0), taxAmount: totals.taxAmount, grandTotal: totals.grandTotal },
    statusHistory: [{ status, changedBy: req.user.id }],
  });
  await writeAudit(req, { action: 'quotation.created', entityType: 'quotation', entityId: quotation.id, summary: `Created quotation ${quotation.quotationNumber}` });
  res.status(201).json(quotation);
});

router.put('/:id', async (req, res) => {
  const quotation = await Quotation.findById(req.params.id);
  if (!quotation) return fail(res, 404, 'QUOTATION_NOT_FOUND', 'Quotation not found');
  if (!canEdit(req.user, quotation)) return fail(res, 403, 'FORBIDDEN', 'You can update quotations assigned to you only');
  if (req.body.customerId && !(await customerAllowed(req.user, req.body.customerId))) return fail(res, 400, 'CUSTOMER_INVALID', 'Select a customer assigned to you');
  const previousStatus = quotation.status;
  const { createdBy: _createdBy, updatedBy: _updatedBy, statusHistory: _statusHistory, revision: _revision, revisionOf: _revisionOf, ...updates } = req.body;
  Object.assign(quotation, updates, { updatedBy: req.user.id });
  const commercialError = validateCommercialTerms(quotation);
  if (commercialError) return fail(res, 400, 'COMMERCIAL_INVALID', commercialError);
  const totals = calculateTotals(quotation);
  if (!totals.items.length || totals.subtotal <= 0) return fail(res, 400, 'ITEMS_REQUIRED', 'Add at least one priced line item before saving');
  Object.assign(quotation, totals, { commercialSnapshot: { items: totals.items, subtotal: totals.subtotal, discount: quotation.discount, discountType: quotation.discountType, taxRate: quotation.taxRate, taxAmount: totals.taxAmount, grandTotal: totals.grandTotal } });
  if (quotation.status !== previousStatus) quotation.statusHistory.push({ status: quotation.status, changedBy: req.user.id, note: req.body.statusNote || '' });
  await quotation.save();
  await writeAudit(req, { action: 'quotation.updated', entityType: 'quotation', entityId: quotation.id, summary: `Updated quotation ${quotation.quotationNumber}` });
  res.json(quotation);
});

router.post('/:id/duplicate', async (req, res) => {
  const original = await Quotation.findOne({ _id: req.params.id, ...ownFilter(req.user) }).lean();
  if (!original) return fail(res, 404, 'QUOTATION_NOT_FOUND', 'Quotation not found');
  delete original._id; delete original.__v; delete original.createdAt; delete original.updatedAt;
  const reference = req.body.quotationNumber || `${original.quotationNumber}-COPY-${Date.now().toString().slice(-5)}`;
  const copy = await Quotation.create({ ...original, quotationNumber: reference, status: 'draft', revision: 1, revisionOf: null, assignedTo: req.user.id, createdBy: req.user.id, updatedBy: req.user.id, statusHistory: [{ status: 'draft', changedBy: req.user.id }] });
  await writeAudit(req, { action: 'quotation.duplicated', entityType: 'quotation', entityId: copy.id, summary: `Duplicated ${original.quotationNumber} as ${reference}` });
  res.status(201).json(copy);
});

router.post('/:id/revisions', async (req, res) => {
  const original = await Quotation.findOne({ _id: req.params.id, ...ownFilter(req.user) }).lean();
  if (!original) return fail(res, 404, 'QUOTATION_NOT_FOUND', 'Quotation not found');
  const rootId = original.revisionOf || original._id;
  const latest = await Quotation.findOne({ $or: [{ _id: rootId }, { revisionOf: rootId }] }).sort({ revision: -1 }).lean();
  delete original._id; delete original.__v; delete original.createdAt; delete original.updatedAt;
  const revision = (latest?.revision || 1) + 1;
  const reference = req.body.quotationNumber || `${original.quotationNumber.replace(/-R\d+$/, '')}-R${revision}`;
  const created = await Quotation.create({ ...original, quotationNumber: reference, status: 'draft', revision, revisionOf: rootId, assignedTo: req.user.id, createdBy: req.user.id, updatedBy: req.user.id, statusHistory: [{ status: 'draft', changedBy: req.user.id }] });
  await writeAudit(req, { action: 'quotation.revision_created', entityType: 'quotation', entityId: created.id, summary: `Created revision ${revision} of ${original.quotationNumber}` });
  res.status(201).json(created);
});

router.get('/:id/revisions', async (req, res) => {
  const quote = await Quotation.findOne({ _id: req.params.id, ...ownFilter(req.user) });
  if (!quote) return fail(res, 404, 'QUOTATION_NOT_FOUND', 'Quotation not found');
  const rootId = quote.revisionOf || quote._id;
  res.json(await Quotation.find({ $or: [{ _id: rootId }, { revisionOf: rootId }] }).sort({ revision: 1 }));
});

router.post('/:id/approval', async (req, res) => {
  const quotation = await Quotation.findById(req.params.id);
  if (!quotation) return fail(res, 404, 'QUOTATION_NOT_FOUND', 'Quotation not found');
  if (!canEdit(req.user, quotation)) return fail(res, 403, 'FORBIDDEN', 'You cannot request approval for this quotation');
  quotation.status = 'pending_approval';
  quotation.approval = { requestedBy: req.user.id, requestedAt: new Date(), note: String(req.body.note || '') };
  quotation.statusHistory.push({ status: 'pending_approval', changedBy: req.user.id, note: req.body.note || '' });
  await quotation.save();
  await writeAudit(req, { action: 'quotation.approval_requested', entityType: 'quotation', entityId: quotation.id, summary: `Approval requested for ${quotation.quotationNumber}` });
  res.json(quotation);
});

router.patch('/:id/approval', async (req, res) => {
  if (!hasPermission(req.user, 'quotations_approve')) return fail(res, 403, 'FORBIDDEN', 'Quotation approval access is required');
  const quotation = await Quotation.findById(req.params.id);
  if (!quotation) return fail(res, 404, 'QUOTATION_NOT_FOUND', 'Quotation not found');
  if (quotation.status !== 'pending_approval') return fail(res, 409, 'APPROVAL_NOT_PENDING', 'This quotation is not awaiting approval');
  const approved = req.body.decision === 'approved';
  quotation.status = approved ? 'approved' : 'rejected';
  quotation.approval.decidedBy = req.user.id; quotation.approval.decidedAt = new Date(); quotation.approval.note = String(req.body.note || '');
  quotation.statusHistory.push({ status: quotation.status, changedBy: req.user.id, note: req.body.note || '' });
  await quotation.save();
  await writeAudit(req, { action: `quotation.${quotation.status}`, entityType: 'quotation', entityId: quotation.id, summary: `${approved ? 'Approved' : 'Rejected'} ${quotation.quotationNumber}` });
  res.json(quotation);
});

router.patch('/:id/status', async (req, res) => {
  const quotation = await Quotation.findById(req.params.id);
  if (!quotation) return fail(res, 404, 'QUOTATION_NOT_FOUND', 'Quotation not found');
  if (!canEdit(req.user, quotation)) return fail(res, 403, 'FORBIDDEN', 'You cannot change this quotation');
  const next = req.body.status;
  if (!statuses.includes(next) || !transitions[quotation.status]?.includes(next)) return fail(res, 409, 'STATUS_TRANSITION_INVALID', `Cannot move a ${quotation.status} quotation to ${next}`);
  quotation.status = next; quotation.updatedBy = req.user.id;
  quotation.statusHistory.push({ status: next, changedBy: req.user.id, note: req.body.note || '' });
  await quotation.save();
  await writeAudit(req, { action: 'quotation.status_changed', entityType: 'quotation', entityId: quotation.id, summary: `${quotation.quotationNumber} moved to ${next}` });
  res.json(quotation);
});

router.delete('/:id', async (req, res) => {
  const quotation = await Quotation.findById(req.params.id);
  if (!quotation) return fail(res, 404, 'QUOTATION_NOT_FOUND', 'Quotation not found');
  if (!hasPermission(req.user, 'quotations_delete_all') && !(owns(req.user, quotation) && hasPermission(req.user, 'quotations_delete_own'))) return fail(res, 403, 'FORBIDDEN', 'You cannot delete this quotation');
  await quotation.deleteOne();
  await writeAudit(req, { action: 'quotation.deleted', entityType: 'quotation', entityId: quotation.id, summary: `Deleted ${quotation.quotationNumber}` });
  res.json({ message: 'Quotation deleted successfully', id: req.params.id });
});

export default router;
