import express from 'express';
import { Customer } from '../models/Customer.js';
import { Quotation } from '../models/Quotation.js';
import { hasPermission } from '../middleware/auth.js';
import { pagination, paginated } from '../lib/api.js';
import { writeAudit } from '../models/AuditLog.js';

const router = express.Router();
const fail = (res, status, code, message) => res.status(status).json({ error: { code, message } });
const ownFilter = user => hasPermission(user, 'customers_view_all')
  ? {}
  : { $or: [{ createdBy: user.id }, { assignedTo: user.id }] };
const canEdit = (user, record) => hasPermission(user, 'customers_manage_all')
  || [record.createdBy, record.assignedTo].some(value => value?.toString() === user.id);

router.get('/', async (req, res) => {
  const filter = { ...ownFilter(req.user) };
  if (req.query.search) {
    const search = String(req.query.search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const searchFilter = { $or: ['name', 'email', 'phone', 'city'].map(field => ({ [field]: { $regex: search, $options: 'i' } })) };
    filter.$and = [ownFilter(req.user), searchFilter];
    delete filter.$or;
  }
  if (req.query.city) filter.city = req.query.city;
  if (!req.query.page && !req.query.search && !req.query.city) return res.json(await Customer.find(filter).sort({ createdAt: -1 }));
  const { page, limit, skip } = pagination(req.query);
  const [items, total] = await Promise.all([Customer.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(), Customer.countDocuments(filter)]);
  res.json(paginated(items.map(item => ({ ...item, id: item._id.toString() })), total, page, limit));
});

router.get('/:id', async (req, res) => {
  const customer = await Customer.findOne({ _id: req.params.id, ...ownFilter(req.user) });
  if (!customer) return fail(res, 404, 'CUSTOMER_NOT_FOUND', 'Customer not found');
  res.json(customer);
});

router.post('/', async (req, res) => {
  const customer = await Customer.create({ ...req.body, assignedTo: req.body.assignedTo || req.user.id, createdBy: req.user.id, updatedBy: req.user.id });
  await writeAudit(req, { action: 'customer.created', entityType: 'customer', entityId: customer.id, summary: `Created customer ${customer.name}` });
  res.status(201).json(customer);
});

router.put('/:id', async (req, res) => {
  const customer = await Customer.findById(req.params.id);
  if (!customer) return fail(res, 404, 'CUSTOMER_NOT_FOUND', 'Customer not found');
  if (!canEdit(req.user, customer)) return fail(res, 403, 'FORBIDDEN', 'You can update customers assigned to you only');
  const { createdBy: _createdBy, updatedBy: _updatedBy, ...updates } = req.body;
  Object.assign(customer, updates, { updatedBy: req.user.id });
  await customer.save();
  await writeAudit(req, { action: 'customer.updated', entityType: 'customer', entityId: customer.id, summary: `Updated customer ${customer.name}` });
  res.json(customer);
});

router.delete('/:id', async (req, res) => {
  const customer = await Customer.findById(req.params.id);
  if (!customer) return fail(res, 404, 'CUSTOMER_NOT_FOUND', 'Customer not found');
  const owns = [customer.createdBy, customer.assignedTo].some(value => value?.toString() === req.user.id);
  if (!hasPermission(req.user, 'customers_delete_all') && !(owns && hasPermission(req.user, 'customers_delete_own'))) return fail(res, 403, 'FORBIDDEN', 'You cannot delete this customer');
  if (await Quotation.exists({ customerId: req.params.id })) return fail(res, 409, 'CUSTOMER_IN_USE', 'This customer has quotations and cannot be deleted');
  await customer.deleteOne();
  await writeAudit(req, { action: 'customer.deleted', entityType: 'customer', entityId: customer.id, summary: `Deleted customer ${customer.name}` });
  res.json({ message: 'Customer deleted successfully', id: req.params.id });
});

export default router;
