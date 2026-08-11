import express from 'express';
import { Quotation } from '../models/Quotation.js';
import { Customer } from '../models/Customer.js';
import { allowRoles } from '../middleware/auth.js';

const router = express.Router();

// GET all quotations
router.get('/', async (req, res) => {
  try {
    const quotations = await Quotation.find().sort({ createdAt: -1 });
    res.json(quotations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET single quotation
router.get('/:id', async (req, res) => {
  try {
    const quotation = await Quotation.findById(req.params.id);
    if (!quotation) return res.status(404).json({ error: 'Quotation not found' });
    res.json(quotation);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST create quotation
router.post('/', async (req, res) => {
  try {
    if (!(await Customer.exists({ _id: req.body.customerId }))) return res.status(400).json({ error: 'Select a valid customer' });
    const items = (req.body.items || []).filter(item => Number(item.quantity) > 0 && String(item.name || '').trim()).map(item => ({ ...item, total: Number(item.quantity) * Number(item.unitPrice || 0) }));
    const subtotal = items.reduce((sum, item) => sum + item.total, 0);
    if (!items.length || subtotal <= 0) return res.status(400).json({ error: 'Add at least one priced line item before saving' });
    const discount = Number(req.body.discount || 0);
    if (req.body.discountType === 'percent' && discount > 100) return res.status(400).json({ error: 'Percentage discount cannot exceed 100%' });
    const discountAmount = req.body.discountType === 'fixed' ? discount : subtotal * (discount / 100);
    const quotation = new Quotation({
      ...req.body,
      items,
      subtotal,
      grandTotal: Math.max(0, subtotal - discountAmount),
      createdBy: req.user.id,
      updatedBy: req.user.id,
      statusHistory: [{ status: req.body.status || 'draft', changedBy: req.user.id }],
    });
    await quotation.save();
    res.status(201).json(quotation);
  } catch (error) {
    res.status(error.code === 11000 ? 409 : 400).json({ error: error.code === 11000 ? 'Quotation reference already exists' : error.message });
  }
});

// PUT update quotation
router.put('/:id', async (req, res) => {
  try {
    const quotation = await Quotation.findById(req.params.id);
    if (!quotation) return res.status(404).json({ error: 'Quotation not found' });
    if (req.user.role === 'employee' && quotation.createdBy && quotation.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Employees can update quotations they created only' });
    }
    const previousStatus = quotation.status;
    const { createdBy: _createdBy, updatedBy: _updatedBy, statusHistory: _statusHistory, ...updates } = req.body;
    if (updates.customerId && !(await Customer.exists({ _id: updates.customerId }))) return res.status(400).json({ error: 'Select a valid customer' });
    Object.assign(quotation, updates, { updatedBy: req.user.id });
    quotation.items = (quotation.items || []).filter(item => Number(item.quantity) > 0 && String(item.name || '').trim()).map(item => {
      item.total = Number(item.quantity || 0) * Number(item.unitPrice || 0);
      return item;
    });
    quotation.subtotal = quotation.items.reduce((sum, item) => sum + item.total, 0);
    if (!quotation.items.length || quotation.subtotal <= 0) return res.status(400).json({ error: 'Add at least one priced line item before saving' });
    if (quotation.discountType === 'percent' && quotation.discount > 100) return res.status(400).json({ error: 'Percentage discount cannot exceed 100%' });
    const discountAmount = quotation.discountType === 'fixed' ? quotation.discount : quotation.subtotal * (quotation.discount / 100);
    quotation.grandTotal = Math.max(0, quotation.subtotal - discountAmount);
    if (quotation.status !== previousStatus) quotation.statusHistory.push({ status: quotation.status, changedBy: req.user.id });
    await quotation.save();
    res.json(quotation);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// DELETE quotation
router.delete('/:id', allowRoles('super_admin', 'admin', 'manager'), async (req, res) => {
  try {
    const quotation = await Quotation.findByIdAndDelete(req.params.id);
    if (!quotation) return res.status(404).json({ error: 'Quotation not found' });
    res.json({ message: 'Quotation deleted successfully', id: req.params.id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
