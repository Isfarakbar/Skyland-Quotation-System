import express from 'express';
import { Setting } from '../models/Setting.js';
import { hasPermission } from '../middleware/auth.js';

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
router.post('/', async (req, res) => {
  try {
    const { key, value } = req.body;
    const quotationDefaultKeys = ['validityDays', 'advancePercent', 'exchangeRate', 'defaultTerms', 'approvalThreshold', 'followUpDays'];
    const canManageCompany = ['super_admin', 'admin'].includes(req.user.role);
    if (!canManageCompany && (!hasPermission(req.user, 'settings_manage') || !quotationDefaultKeys.includes(key))) {
      return res.status(403).json({ error: 'You can update quotation defaults only when that access is granted' });
    }
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
