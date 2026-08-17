import express from 'express';
import { User, USER_PERMISSION_KEYS, USER_ROLES, USER_STATUSES } from '../models/User.js';
import { allowRoles } from '../middleware/auth.js';
import { sendEmail } from '../services/email.js';

const router = express.Router();

router.get('/', allowRoles('super_admin', 'admin'), async (req, res) => {
  const filter = {};
  if (req.query.status && USER_STATUSES.includes(req.query.status)) filter.status = req.query.status;
  const users = await User.find(filter).sort({ createdAt: -1 });
  res.json(users.map(user => user.toJSON()));
});

router.patch('/:id/approval', allowRoles('super_admin'), async (req, res) => {
  const status = req.body.status;
  if (!['active', 'rejected'].includes(status)) return res.status(400).json({ error: 'Approval status must be active or rejected' });
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (!['manager', 'employee'].includes(user.role)) return res.status(400).json({ error: 'Only manager and employee registrations use approval' });
  if (user.status !== 'pending') return res.status(409).json({ error: 'This registration has already been reviewed' });
  user.status = status;
  user.approvedBy = req.user.id;
  user.approvedAt = status === 'active' ? new Date() : null;
  await user.save();
  sendEmail({
    to: user.email,
    name: user.firstName,
    subject: status === 'active' ? 'Your Skyland account is approved' : 'Skyland account request update',
    html: status === 'active'
      ? `<p>Hello ${user.firstName},</p><p>Your Skyland account has been approved. You can now sign in.</p>`
      : `<p>Hello ${user.firstName},</p><p>Your Skyland account request was not approved. Please contact an administrator if you need more information.</p>`,
  }).catch(error => console.error('Approval email failed:', error.message));
  res.json(user);
});

router.patch('/:id', allowRoles('super_admin', 'admin'), async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (user.role === 'super_admin') return res.status(403).json({ error: 'The super admin account cannot be modified here' });
  if (user.id === req.user.id) return res.status(400).json({ error: 'Use My Account to manage your own profile' });
  if (user.status === 'pending') return res.status(409).json({ error: 'Pending registrations must use the approval action' });
  if (req.user.role === 'admin') {
    if (req.body.role) return res.status(403).json({ error: 'Only a super admin can change roles' });
    if (!['manager', 'employee'].includes(user.role) || !['active', 'suspended'].includes(user.status) || !['active', 'suspended'].includes(req.body.status)) {
      return res.status(403).json({ error: 'Admins can suspend or reactivate approved managers and employees only' });
    }
  }
  if (req.body.role) {
    if (!['admin', 'manager', 'employee'].includes(req.body.role)) return res.status(400).json({ error: 'Invalid role' });
    if (user.role !== req.body.role) user.permissions = {};
    user.role = req.body.role;
  }
  if (req.body.status) {
    if (!USER_STATUSES.includes(req.body.status) || req.body.status === 'pending') return res.status(400).json({ error: 'Invalid account status' });
    user.status = req.body.status;
    if (req.body.status === 'active') user.approvedAt ||= new Date();
  }
  await user.save();
  res.json(user);
});

router.patch('/:id/permissions', allowRoles('super_admin'), async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (!['manager', 'employee'].includes(user.role)) {
    return res.status(400).json({ error: 'Custom access can be assigned to managers and employees only' });
  }
  const submitted = req.body.permissions;
  if (!submitted || typeof submitted !== 'object' || Array.isArray(submitted)) {
    return res.status(400).json({ error: 'Permissions must be an object' });
  }
  const invalidKeys = Object.keys(submitted).filter(key => !USER_PERMISSION_KEYS.includes(key));
  if (invalidKeys.length) return res.status(400).json({ error: `Invalid permissions: ${invalidKeys.join(', ')}` });
  if (Object.values(submitted).some(value => typeof value !== 'boolean')) {
    return res.status(400).json({ error: 'Every permission value must be true or false' });
  }
  user.permissions = Object.fromEntries(Object.entries(submitted).map(([key, value]) => [key, Boolean(value)]));
  user.sessionVersion += 1;
  await user.save();
  res.json({ user: user.toJSON(), message: Object.keys(submitted).length ? 'Custom access updated' : 'Role defaults restored' });
});

export default router;
