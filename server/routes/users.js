import express from 'express';
import { User, USER_PERMISSION_KEYS, USER_STATUSES, getEffectivePermissions } from '../models/User.js';
import { allowRoles } from '../middleware/auth.js';
import { sendEmail } from '../services/email.js';
import { Session } from '../models/Session.js';
import { writeAudit } from '../models/AuditLog.js';
import { hasPermission } from '../middleware/auth.js';
import { pagination, paginated } from '../lib/api.js';

const router = express.Router();

const teamListFields = 'firstName lastName email phone designation profilePicture role permissions status createdAt approvedAt';
const serializeTeamUser = user => {
  const permissions = user.permissions instanceof Map ? Object.fromEntries(user.permissions) : (user.permissions || {});
  return {
    id: user._id.toString(),
    firstName: user.firstName || '',
    lastName: user.lastName || '',
    email: user.email,
    phone: user.phone || '',
    designation: user.designation || '',
    profilePicture: user.profilePicture || '',
    role: user.role,
    permissions,
    effectivePermissions: getEffectivePermissions({ ...user, permissions }),
    status: user.status,
    createdAt: user.createdAt,
    approvedAt: user.approvedAt,
  };
};

router.get('/', allowRoles('super_admin', 'admin'), async (req, res) => {
  const filter = {};
  if (req.query.status && USER_STATUSES.includes(req.query.status)) filter.status = req.query.status;
  if (req.query.role) filter.role = req.query.role;
  if (req.query.search) {
    const search = String(req.query.search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = ['firstName', 'lastName', 'email', 'phone'].map(field => ({ [field]: { $regex: search, $options: 'i' } }));
  }
  if (!req.query.page && !req.query.search && !req.query.role) {
    const users = await User.find(filter).select(teamListFields).sort({ createdAt: -1 }).lean();
    res.set('Cache-Control', 'private, no-store');
    return res.json(users.map(serializeTeamUser));
  }
  const { page, limit, skip } = pagination(req.query, { defaultLimit: 20 });
  const [users, total] = await Promise.all([
    User.find(filter).select(teamListFields).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    User.countDocuments(filter),
  ]);
  res.set('Cache-Control', 'private, no-store');
  res.json(paginated(users.map(serializeTeamUser), total, page, limit));
});

router.get('/:id', allowRoles('super_admin', 'admin'), async (req, res) => {
  if (!hasPermission(req.user, 'users_view_sensitive')) return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Sensitive team details access is required' } });
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ error: { code: 'USER_NOT_FOUND', message: 'User not found' } });
  res.set('Cache-Control', 'private, no-store');
  res.json(user.toJSON());
});

router.patch('/:id/approval', allowRoles('super_admin'), async (req, res) => {
  const status = req.body.status;
  if (!['active', 'rejected'].includes(status)) return res.status(400).json({ error: 'Approval status must be active or rejected' });
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (!['manager', 'employee'].includes(user.role)) return res.status(400).json({ error: 'Only manager and employee registrations use approval' });
  if (user.status !== 'pending') return res.status(409).json({ error: 'This registration has already been reviewed' });
  if (status === 'active' && !user.emailVerifiedAt && process.env.EMAIL_DISABLED !== '1') return res.status(409).json({ error: { code: 'EMAIL_UNVERIFIED', message: 'The user must verify their email before approval' } });
  user.status = status;
  user.approvedBy = req.user.id;
  user.approvedAt = status === 'active' ? new Date() : null;
  await user.save();
  await writeAudit(req, { action: `user.${status === 'active' ? 'approved' : 'rejected'}`, entityType: 'user', entityId: user.id, summary: `${user.email} was ${status === 'active' ? 'approved' : 'rejected'}` });
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
  await Session.deleteMany({ userId: user.id });
  await writeAudit(req, { action: 'user.updated', entityType: 'user', entityId: user.id, summary: `Updated ${user.email} role or status` });
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
  await Session.deleteMany({ userId: user.id });
  await writeAudit(req, { action: 'user.permissions_updated', entityType: 'user', entityId: user.id, summary: `Updated access for ${user.email}`, metadata: { keys: Object.keys(submitted) } });
  res.json({ user: user.toJSON(), message: Object.keys(submitted).length ? 'Custom access updated' : 'Role defaults restored' });
});

export default router;
