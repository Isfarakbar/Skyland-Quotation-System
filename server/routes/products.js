import express from 'express';
import { Product } from '../models/Product.js';
import { allowPermission } from '../middleware/auth.js';

const router = express.Router();

// GET all products
router.get('/', async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET single product
router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(product);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST create product
router.post('/', allowPermission('products_manage'), async (req, res) => {
  try {
    const product = new Product({ ...req.body, createdBy: req.user.id, updatedBy: req.user.id });
    await product.save();
    res.status(201).json(product);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// PUT update product
router.put('/:id', allowPermission('products_manage'), async (req, res) => {
  try {
    const { createdBy: _createdBy, updatedBy: _updatedBy, ...updates } = req.body;
    const product = await Product.findByIdAndUpdate(req.params.id, { ...updates, updatedBy: req.user.id }, {
      returnDocument: 'after',
      runValidators: true,
    });
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(product);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// DELETE product
router.patch('/:id/rate', allowPermission('rates_manage'), async (req, res) => {
  try {
    const updates = {};
    if (req.body.unitPrice !== undefined) updates.unitPrice = req.body.unitPrice;
    if (req.body.pricePerWatt !== undefined) updates.pricePerWatt = req.body.pricePerWatt;
    const product = await Product.findByIdAndUpdate(req.params.id, { ...updates, updatedBy: req.user.id }, {
      returnDocument: 'after', runValidators: true,
    });
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(product);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.delete('/:id', allowPermission('products_delete'), async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json({ message: 'Product deleted successfully', id: req.params.id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
