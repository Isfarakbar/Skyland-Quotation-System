import express from 'express';
import { Setting } from '../models/Setting.js';

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
    const setting = await Setting.findOneAndUpdate(
      { key },
      { key, value },
      { upsert: true, new: true, runValidators: true }
    );
    res.json(setting);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
