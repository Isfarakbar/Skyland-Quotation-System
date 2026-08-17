import express from 'express';
import { Customer } from '../models/Customer.js';
import { Quotation } from '../models/Quotation.js';
import { allowPermission, hasPermission } from '../middleware/auth.js';

const router = express.Router();

// GET all customers
router.get('/', async (req, res) => {
  try {
    const customers = await Customer.find().sort({ createdAt: -1 });
    res.json(customers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET single customer
router.get('/:id', async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) return res.status(404).json({ error: 'Customer not found' });
    res.json(customer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST create customer
router.post('/', async (req, res) => {
  try {
    const customer = new Customer({ ...req.body, createdBy: req.user.id, updatedBy: req.user.id });
    await customer.save();
    res.status(201).json(customer);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// PUT update customer
router.put('/:id', async (req, res) => {
  try {
    const existing = await Customer.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Customer not found' });
    if (!hasPermission(req.user, 'customers_manage_all') && existing.createdBy && existing.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ error: 'You can update customer records you created only' });
    }
    const { createdBy: _createdBy, updatedBy: _updatedBy, ...updates } = req.body;
    const customer = await Customer.findByIdAndUpdate(req.params.id, { ...updates, updatedBy: req.user.id }, {
      returnDocument: 'after',
      runValidators: true,
    });
    if (!customer) return res.status(404).json({ error: 'Customer not found' });
    res.json(customer);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// DELETE customer
router.delete('/:id', allowPermission('customers_delete'), async (req, res) => {
  try {
    if (await Quotation.exists({ customerId: req.params.id })) {
      return res.status(409).json({ error: 'This customer has quotations and cannot be deleted. Remove the related quotations first or retain the customer record.' });
    }
    const customer = await Customer.findByIdAndDelete(req.params.id);
    if (!customer) return res.status(404).json({ error: 'Customer not found' });
    res.json({ message: 'Customer deleted successfully', id: req.params.id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
