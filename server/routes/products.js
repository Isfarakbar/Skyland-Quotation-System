import express from 'express';
import { Product } from '../models/Product.js';
import { allowPermission } from '../middleware/auth.js';
import { pagination, paginated } from '../lib/api.js';
import { writeAudit } from '../models/AuditLog.js';

const router = express.Router();
const fail = (res, status, code, message) => res.status(status).json({ error: { code, message } });

router.get('/', async (req, res) => {
  const filter = {};
  if (req.query.category) filter.category = req.query.category;
  if (req.query.active === 'true') filter.active = true;
  if (req.query.active === 'false') filter.active = false;
  if (req.query.search) {
    const search = String(req.query.search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = ['name', 'brand', 'model', 'capacity'].map(field => ({ [field]: { $regex: search, $options: 'i' } }));
  }
  const sortMap = { name: { name: 1 }, price_asc: { unitPrice: 1 }, price_desc: { unitPrice: -1 }, newest: { createdAt: -1 } };
  const sort = sortMap[req.query.sort] || { createdAt: -1 };
  if (!req.query.page && !req.query.search && !req.query.category && req.query.active === undefined && !req.query.sort) return res.json(await Product.find().sort(sort));
  const { page, limit, skip } = pagination(req.query);
  const [items, total] = await Promise.all([Product.find(filter).sort(sort).skip(skip).limit(limit).lean(), Product.countDocuments(filter)]);
  res.json(paginated(items.map(item => ({ ...item, id: item._id.toString() })), total, page, limit));
});

router.get('/:id', async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) return fail(res, 404, 'PRODUCT_NOT_FOUND', 'Product not found');
  res.json(product);
});

router.post('/', allowPermission('products_manage'), async (req, res) => {
  const product = await Product.create({ ...req.body, createdBy: req.user.id, updatedBy: req.user.id });
  await writeAudit(req, { action: 'product.created', entityType: 'product', entityId: product.id, summary: `Created ${product.name}` });
  res.status(201).json(product);
});

router.put('/:id', allowPermission('products_manage'), async (req, res) => {
  const { createdBy: _createdBy, updatedBy: _updatedBy, priceHistory: _priceHistory, ...updates } = req.body;
  const product = await Product.findByIdAndUpdate(req.params.id, { ...updates, updatedBy: req.user.id }, { returnDocument: 'after', runValidators: true });
  if (!product) return fail(res, 404, 'PRODUCT_NOT_FOUND', 'Product not found');
  await writeAudit(req, { action: 'product.updated', entityType: 'product', entityId: product.id, summary: `Updated ${product.name}` });
  res.json(product);
});

router.patch('/:id/rate', allowPermission('rates_manage'), async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) return fail(res, 404, 'PRODUCT_NOT_FOUND', 'Product not found');
  product.priceHistory.push({ unitPrice: product.unitPrice, pricePerWatt: product.pricePerWatt, changedBy: req.user.id });
  if (req.body.unitPrice !== undefined) product.unitPrice = Number(req.body.unitPrice);
  if (req.body.pricePerWatt !== undefined) product.pricePerWatt = Number(req.body.pricePerWatt);
  product.effectiveFrom = req.body.effectiveFrom ? new Date(req.body.effectiveFrom) : new Date();
  product.updatedBy = req.user.id;
  await product.save();
  await writeAudit(req, { action: 'product.rate_changed', entityType: 'product', entityId: product.id, summary: `Changed rates for ${product.name}` });
  res.json(product);
});

router.post('/bulk-rates', allowPermission('rates_manage'), async (req, res) => {
  const changes = Array.isArray(req.body.changes) ? req.body.changes.slice(0, 200) : [];
  const updated = [];
  for (const change of changes) {
    const product = await Product.findById(change.id);
    if (!product) continue;
    product.priceHistory.push({ unitPrice: product.unitPrice, pricePerWatt: product.pricePerWatt, changedBy: req.user.id });
    if (change.unitPrice !== undefined) product.unitPrice = Number(change.unitPrice);
    if (change.pricePerWatt !== undefined) product.pricePerWatt = Number(change.pricePerWatt);
    product.updatedBy = req.user.id;
    product.effectiveFrom = new Date();
    await product.save();
    updated.push(product);
  }
  await writeAudit(req, { action: 'product.bulk_rates_changed', entityType: 'product', summary: `Updated ${updated.length} catalog rates` });
  res.json({ items: updated, updated: updated.length });
});

router.post('/:id/rate/rollback', allowPermission('rates_manage'), async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) return fail(res, 404, 'PRODUCT_NOT_FOUND', 'Product not found');
  const previous = product.priceHistory.at(-1);
  if (!previous) return fail(res, 409, 'RATE_HISTORY_EMPTY', 'No earlier rate is available');
  product.priceHistory.push({ unitPrice: product.unitPrice, pricePerWatt: product.pricePerWatt, changedBy: req.user.id });
  product.unitPrice = previous.unitPrice;
  product.pricePerWatt = previous.pricePerWatt;
  product.effectiveFrom = new Date();
  product.updatedBy = req.user.id;
  await product.save();
  await writeAudit(req, { action: 'product.rate_rolled_back', entityType: 'product', entityId: product.id, summary: `Rolled back rates for ${product.name}` });
  res.json(product);
});

router.delete('/:id', allowPermission('products_delete'), async (req, res) => {
  const product = await Product.findByIdAndDelete(req.params.id);
  if (!product) return fail(res, 404, 'PRODUCT_NOT_FOUND', 'Product not found');
  await writeAudit(req, { action: 'product.deleted', entityType: 'product', entityId: product.id, summary: `Deleted ${product.name}` });
  res.json({ message: 'Product deleted successfully', id: req.params.id });
});

export default router;
