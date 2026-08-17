import express from 'express';
import { Setting } from '../models/Setting.js';
import { allowRoles } from '../middleware/auth.js';

const router = express.Router();

// GET all settings
router.get('/', async (req, res) => {
  try {
    const settings = await Setting.find();
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET single setting by key
router.get('/:key', async (req, res) => {
  try {
    const setting = await Setting.findOne({ key: req.params.key });
    if (!setting) return res.status(404).json({ error: 'Setting not found' });
    res.json(setting);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST set key-value setting
router.post('/', allowRoles('super_admin', 'admin', 'manager'), async (req, res) => {
  try {
    const { key, value } = req.body;
    const managerKeys = ['validityDays', 'advancePercent', 'exchangeRate', 'defaultTerms'];
    if (req.user.role === 'manager' && !managerKeys.includes(key)) return res.status(403).json({ error: 'Managers can update quotation defaults only' });
    const setting = await Setting.findOneAndUpdate(
      { key },
      { key, value, updatedBy: req.user.id },
      { upsert: true, returnDocument: 'after', runValidators: true }
    );
    res.json(setting);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
