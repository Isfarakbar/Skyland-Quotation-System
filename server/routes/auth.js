import crypto from 'crypto';
import express from 'express';
import bcrypt from 'bcryptjs';
import { rateLimit } from 'express-rate-limit';
import { User } from '../models/User.js';
import { AUTH_COOKIE, requireAuth, sessionCookieOptions, signSession } from '../middleware/auth.js';
import { sendEmail } from '../services/email.js';

const router = express.Router();
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: 'draft-7', legacyHeaders: false });
const normalizeEmail = value => String(value || '').trim().toLowerCase();
const isStrongPassword = value => typeof value === 'string' && value.length >= 10 && /[a-z]/.test(value) && /[A-Z]/.test(value) && /\d/.test(value);

router.use(authLimiter);

router.post('/register', async (req, res) => {
  try {
    const allowedRoles = ['manager', 'employee'];
    const required = ['firstName', 'lastName', 'email', 'phone', 'dateOfBirth', 'gender', 'cnic', 'address', 'city', 'department', 'designation', 'profilePicture', 'emergencyContactName', 'emergencyContactPhone'];
    const missing = required.filter(field => !String(req.body[field] || '').trim());
    if (missing.length) return res.status(400).json({ error: `Missing required fields: ${missing.join(', ')}` });
    if (!allowedRoles.includes(req.body.role)) return res.status(400).json({ error: 'Public registration is available for managers and employees only' });
    if (!isStrongPassword(req.body.password)) return res.status(400).json({ error: 'Password must be at least 10 characters and include uppercase, lowercase, and a number' });

    const email = normalizeEmail(req.body.email);
    if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: 'Enter a valid email address' });
    if (!String(req.body.profilePicture).startsWith('https://res.cloudinary.com/')) return res.status(400).json({ error: 'Profile picture must be uploaded through Skyland' });
    const dateOfBirth = new Date(req.body.dateOfBirth);
    if (Number.isNaN(dateOfBirth.getTime()) || dateOfBirth >= new Date()) return res.status(400).json({ error: 'Enter a valid date of birth' });
    if (await User.exists({ $or: [{ email }, { cnic: req.body.cnic.trim() }] })) {
      return res.status(409).json({ error: 'An account with this email or CNIC already exists' });
    }

    const user = await User.create({
      ...req.body,
      email,
      passwordHash: await bcrypt.hash(req.body.password, 12),
      password: undefined,
      role: req.body.role,
      status: 'pending',
    });
    if (process.env.SUPER_ADMIN_EMAIL) {
      const appUrl = (process.env.APP_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
      sendEmail({
        to: process.env.SUPER_ADMIN_EMAIL,
        name: 'Super Admin',
        subject: `New ${user.role.replace('_', ' ')} registration awaiting approval`,
        html: `<p>${user.firstName} ${user.lastName} has requested a ${user.role.replace('_', ' ')} account.</p><p>Department: ${user.department}<br>Designation: ${user.designation}<br>Email: ${user.email}</p><p><a href="${appUrl}/#/users">Review team access</a></p>`,
      }).catch(error => console.error('Registration notification failed:', error.message));
    }
    res.status(201).json({ message: 'Registration submitted. A super admin must approve your account before you can sign in.', user: user.toJSON() });
  } catch (error) {
    res.status(400).json({ error: error.code === 11000 ? 'Email or CNIC already registered' : error.message });
  }
});

router.post('/login', async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const user = await User.findOne({ email }).select('+passwordHash');
  if (!user || !(await bcrypt.compare(String(req.body.password || ''), user.passwordHash))) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  if (user.status === 'pending') return res.status(403).json({ error: 'Your registration is awaiting super admin approval' });
  if (user.status !== 'active') return res.status(403).json({ error: `Your account is ${user.status}` });

  user.lastLoginAt = new Date();
  await user.save();
  res.cookie(AUTH_COOKIE, signSession(user), sessionCookieOptions());
  res.json({ user: user.toJSON() });
});

router.post('/logout', (_req, res) => {
  res.clearCookie(AUTH_COOKIE, { ...sessionCookieOptions(), maxAge: undefined });
  res.status(204).end();
});

router.get('/me', requireAuth, (req, res) => res.json({ user: req.user.toJSON() }));

router.patch('/profile', requireAuth, async (req, res) => {
  const allowedFields = [
    'firstName', 'lastName', 'phone', 'alternatePhone', 'dateOfBirth', 'gender', 'address', 'city',
    'department', 'designation', 'employeeId', 'profilePicture', 'emergencyContactName', 'emergencyContactPhone',
  ];
  const requiredProfileFields = ['firstName', 'lastName', 'phone', 'dateOfBirth', 'gender', 'address', 'city', 'department', 'designation', 'emergencyContactName', 'emergencyContactPhone'];
  for (const field of requiredProfileFields) {
    if (req.body[field] !== undefined && !String(req.body[field]).trim()) return res.status(400).json({ error: `${field} cannot be empty` });
  }
  if (req.body.dateOfBirth !== undefined) {
    const dateOfBirth = new Date(req.body.dateOfBirth);
    if (Number.isNaN(dateOfBirth.getTime()) || dateOfBirth >= new Date()) return res.status(400).json({ error: 'Enter a valid date of birth' });
  }
  if (req.body.profilePicture !== undefined && req.body.profilePicture && !String(req.body.profilePicture).startsWith('https://res.cloudinary.com/')) {
    return res.status(400).json({ error: 'Profile picture must be uploaded through Skyland' });
  }
  for (const field of allowedFields) {
    if (req.body[field] !== undefined) req.user[field] = req.body[field];
  }
  await req.user.save();
  res.json({ user: req.user.toJSON(), message: 'Profile updated successfully' });
});

router.post('/forgot-password', async (req, res) => {
  const generic = { message: 'If an active account exists, password reset instructions have been sent.' };
  const user = await User.findOne({ email: normalizeEmail(req.body.email), status: 'active' }).select('+passwordResetTokenHash +passwordResetExpiresAt');
  if (!user) return res.json(generic);

  const token = crypto.randomBytes(32).toString('hex');
  user.passwordResetTokenHash = crypto.createHash('sha256').update(token).digest('hex');
  user.passwordResetExpiresAt = new Date(Date.now() + 30 * 60 * 1000);
  await user.save();

  const appUrl = (process.env.APP_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
  try {
    await sendEmail({
      to: user.email,
      name: user.firstName,
      subject: 'Reset your Skyland password',
      html: `<p>Hello ${user.firstName},</p><p>Use the secure link below within 30 minutes to reset your password.</p><p><a href="${appUrl}/#/reset-password/${token}">Reset password</a></p><p>If you did not request this, you can ignore this email.</p>`,
    });
  } catch (error) {
    console.error('Password reset email failed:', error.message);
  }
  res.json(generic);
});

router.post('/reset-password', async (req, res) => {
  if (!isStrongPassword(req.body.password)) return res.status(400).json({ error: 'Password must be at least 10 characters and include uppercase, lowercase, and a number' });
  const tokenHash = crypto.createHash('sha256').update(String(req.body.token || '')).digest('hex');
  const user = await User.findOne({ passwordResetTokenHash: tokenHash, passwordResetExpiresAt: { $gt: new Date() } }).select('+passwordHash +passwordResetTokenHash +passwordResetExpiresAt');
  if (!user) return res.status(400).json({ error: 'This password reset link is invalid or expired' });
  user.passwordHash = await bcrypt.hash(req.body.password, 12);
  user.sessionVersion += 1;
  user.passwordResetTokenHash = null;
  user.passwordResetExpiresAt = null;
  await user.save();
  res.json({ message: 'Password reset successfully. You can now sign in.' });
});

router.post('/change-password', requireAuth, async (req, res) => {
  if (!isStrongPassword(req.body.newPassword)) return res.status(400).json({ error: 'New password does not meet the security requirements' });
  const user = await User.findById(req.user.id).select('+passwordHash');
  if (!(await bcrypt.compare(String(req.body.currentPassword || ''), user.passwordHash))) return res.status(400).json({ error: 'Current password is incorrect' });
  user.passwordHash = await bcrypt.hash(req.body.newPassword, 12);
  user.sessionVersion += 1;
  await user.save();
  res.json({ message: 'Password changed successfully' });
});

export default router;
