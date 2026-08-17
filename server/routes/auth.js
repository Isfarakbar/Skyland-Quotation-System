import crypto from 'crypto';
import express from 'express';
import bcrypt from 'bcryptjs';
import { rateLimit } from 'express-rate-limit';
import { generateSecret, generateURI, verify } from 'otplib';
import QRCode from 'qrcode';
import { User } from '../models/User.js';
import { Session } from '../models/Session.js';
import { writeAudit } from '../models/AuditLog.js';
import {
  AUTH_COOKIE, CSRF_COOKIE, createCsrfToken, createSession, csrfCookieOptions,
  destroySession, requireAuth, sessionCookieOptions,
} from '../middleware/auth.js';
import { sendEmail } from '../services/email.js';

const router = express.Router();
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: process.env.NODE_ENV === 'test' ? 1000 : 20,
  standardHeaders: 'draft-7', legacyHeaders: false,
  skip: req => /^\/(me|sessions|logout|profile|change-password|mfa)/.test(req.path),
});
const normalizeEmail = value => String(value || '').trim().toLowerCase();
const isStrongPassword = value => typeof value === 'string' && value.length >= 10 && /[a-z]/.test(value) && /[A-Z]/.test(value) && /\d/.test(value);
const tokenHash = value => crypto.createHash('sha256').update(String(value || '')).digest('hex');
const fail = (res, status, code, message, fields) => res.status(status).json({ error: { code, message, ...(fields ? { fields } : {}) } });

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
    const expectedCloudinaryPrefix = `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME || ''}/`;
    if (!String(req.body.profilePicture).startsWith(expectedCloudinaryPrefix)) return res.status(400).json({ error: 'Profile picture must be uploaded through Skyland' });
    const dateOfBirth = new Date(req.body.dateOfBirth);
    if (Number.isNaN(dateOfBirth.getTime()) || dateOfBirth >= new Date()) return res.status(400).json({ error: 'Enter a valid date of birth' });
    if (await User.exists({ $or: [{ email }, { cnic: req.body.cnic.trim() }] })) {
      return res.status(409).json({ error: 'An account with this email or CNIC already exists' });
    }

    const verificationToken = crypto.randomBytes(32).toString('hex');
    const user = await User.create({
      ...req.body,
      email,
      passwordHash: await bcrypt.hash(req.body.password, 12),
      password: undefined,
      role: req.body.role,
      status: 'pending',
      emailVerifiedAt: process.env.EMAIL_DISABLED === '1' ? new Date() : null,
      emailVerificationTokenHash: process.env.EMAIL_DISABLED === '1' ? null : tokenHash(verificationToken),
      emailVerificationExpiresAt: process.env.EMAIL_DISABLED === '1' ? null : new Date(Date.now() + 24 * 60 * 60 * 1000),
    });
    const appUrl = (process.env.APP_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
    if (process.env.EMAIL_DISABLED !== '1') {
      sendEmail({
        to: user.email,
        name: user.firstName,
        subject: 'Verify your Skyland email address',
        html: `<p>Hello ${user.firstName},</p><p>Verify your email within 24 hours to continue your account request.</p><p><a href="${appUrl}/#/verify-email/${verificationToken}">Verify email</a></p>`,
      }).catch(error => console.error('Verification email failed:', error.message));
    }
    if (process.env.SUPER_ADMIN_EMAIL) {
      sendEmail({
        to: process.env.SUPER_ADMIN_EMAIL,
        name: 'Super Admin',
        subject: `New ${user.role.replace('_', ' ')} registration awaiting approval`,
        html: `<p>${user.firstName} ${user.lastName} has requested a ${user.role.replace('_', ' ')} account.</p><p>Department: ${user.department}<br>Designation: ${user.designation}<br>Email: ${user.email}</p><p><a href="${appUrl}/#/users">Review team access</a></p>`,
      }).catch(error => console.error('Registration notification failed:', error.message));
    }
    await writeAudit(req, { action: 'auth.register', entityType: 'user', entityId: user.id, summary: `${user.email} requested ${user.role} access` });
    res.status(201).json({ message: 'Registration submitted. A super admin must approve your account before you can sign in.', user: user.toJSON() });
  } catch (error) {
    return fail(res, error.code === 11000 ? 409 : 400, error.code === 11000 ? 'ACCOUNT_EXISTS' : 'REGISTRATION_INVALID', error.code === 11000 ? 'Email or CNIC already registered' : 'Check the registration information and try again');
  }
});

router.post('/verify-email', async (req, res) => {
  const user = await User.findOne({ emailVerificationTokenHash: tokenHash(req.body.token), emailVerificationExpiresAt: { $gt: new Date() } })
    .select('+emailVerificationTokenHash +emailVerificationExpiresAt');
  if (!user) return fail(res, 400, 'VERIFICATION_INVALID', 'This verification link is invalid or expired');
  user.emailVerifiedAt = new Date();
  user.emailVerificationTokenHash = null;
  user.emailVerificationExpiresAt = null;
  await user.save();
  await writeAudit(req, { action: 'auth.email_verified', entityType: 'user', entityId: user.id, summary: `${user.email} verified their email` });
  res.json({ message: 'Email verified. Your account is ready for super admin review.' });
});

router.post('/login', async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const user = await User.findOne({ email }).select('+passwordHash +failedLoginAttempts +lockedUntil +mfaSecret +mfaRecoveryCodeHashes');
  if (user?.lockedUntil && user.lockedUntil > new Date()) return fail(res, 429, 'ACCOUNT_LOCKED', 'Too many unsuccessful attempts. Try again later.');
  if (!user || !(await bcrypt.compare(String(req.body.password || ''), user.passwordHash))) {
    if (user) {
      user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
      if (user.failedLoginAttempts >= 5) user.lockedUntil = new Date(Date.now() + 15 * 60 * 1000);
      await user.save();
    }
    return fail(res, 401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  }
  if (!user.emailVerifiedAt && process.env.EMAIL_DISABLED !== '1' && !['super_admin', 'admin'].includes(user.role)) return fail(res, 403, 'EMAIL_UNVERIFIED', 'Verify your email before signing in');
  if (user.status === 'pending') return fail(res, 403, 'APPROVAL_PENDING', 'Your registration is awaiting super admin approval');
  if (user.status !== 'active') return fail(res, 403, 'ACCOUNT_INACTIVE', `Your account is ${user.status}`);
  if (user.mfaEnabled) {
    const mfaResult = await verify({ token: String(req.body.mfaCode || ''), secret: user.mfaSecret || '' });
    if (!mfaResult.valid) return fail(res, 401, 'MFA_REQUIRED', 'Enter the current code from your authenticator app');
  }

  user.lastLoginAt = new Date();
  user.lastLoginIp = req.ip || '';
  user.failedLoginAttempts = 0;
  user.lockedUntil = null;
  await user.save();
  const { token } = await createSession(user, req);
  const csrfToken = createCsrfToken();
  res.cookie(AUTH_COOKIE, token, sessionCookieOptions());
  res.cookie(CSRF_COOKIE, csrfToken, csrfCookieOptions());
  await writeAudit(req, { action: 'auth.login', entityType: 'user', entityId: user.id, summary: `${user.email} signed in` });
  res.json({ user: user.toJSON() });
});

router.post('/logout', async (req, res) => {
  await destroySession(req.cookies?.[AUTH_COOKIE]);
  res.clearCookie(AUTH_COOKIE, { ...sessionCookieOptions(), maxAge: undefined });
  res.clearCookie(CSRF_COOKIE, { ...csrfCookieOptions(), maxAge: undefined });
  res.status(204).end();
});

router.get('/me', requireAuth, (req, res) => res.json({ user: req.user.toJSON() }));

router.get('/sessions', requireAuth, async (req, res) => {
  const sessions = await Session.find({ userId: req.user.id, expiresAt: { $gt: new Date() } }).sort({ createdAt: -1 }).lean();
  res.set('Cache-Control', 'private, no-store');
  res.json(sessions.map(session => ({
    id: session._id.toString(), createdAt: session.createdAt, lastSeenAt: session.lastSeenAt,
    ip: session.ip, userAgent: session.userAgent, current: session._id.toString() === req.session.id,
  })));
});

router.delete('/sessions/:id', requireAuth, async (req, res) => {
  const removed = await Session.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
  if (!removed) return fail(res, 404, 'SESSION_NOT_FOUND', 'Session not found');
  await writeAudit(req, { action: 'auth.session_revoked', entityType: 'session', entityId: req.params.id, summary: 'A signed-in session was revoked' });
  res.status(204).end();
});

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
  const expectedCloudinaryPrefix = `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME || ''}/`;
  if (req.body.profilePicture !== undefined && req.body.profilePicture && !String(req.body.profilePicture).startsWith(expectedCloudinaryPrefix)) {
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
  await Session.deleteMany({ userId: user.id });
  res.json({ message: 'Password reset successfully. You can now sign in.' });
});

router.post('/change-password', requireAuth, async (req, res) => {
  if (!isStrongPassword(req.body.newPassword)) return res.status(400).json({ error: 'New password does not meet the security requirements' });
  const user = await User.findById(req.user.id).select('+passwordHash');
  if (!(await bcrypt.compare(String(req.body.currentPassword || ''), user.passwordHash))) return res.status(400).json({ error: 'Current password is incorrect' });
  user.passwordHash = await bcrypt.hash(req.body.newPassword, 12);
  user.sessionVersion += 1;
  await user.save();
  await Session.deleteMany({ userId: user.id, _id: { $ne: req.session.id } });
  await writeAudit(req, { action: 'auth.password_changed', entityType: 'user', entityId: user.id, summary: 'Password changed and other sessions revoked' });
  res.json({ message: 'Password changed successfully' });
});

router.post('/mfa/setup', requireAuth, async (req, res) => {
  const user = await User.findById(req.user.id).select('+mfaSecret');
  const secret = generateSecret();
  user.mfaSecret = secret;
  user.mfaEnabled = false;
  await user.save();
  const issuer = 'Skyland Energy';
  const uri = generateURI({ issuer, label: user.email, secret });
  res.json({ secret, qrCode: await QRCode.toDataURL(uri) });
});

router.post('/mfa/verify', requireAuth, async (req, res) => {
  const user = await User.findById(req.user.id).select('+mfaSecret');
  const mfaResult = user?.mfaSecret ? await verify({ token: String(req.body.code || ''), secret: user.mfaSecret }) : { valid: false };
  if (!mfaResult.valid) return fail(res, 400, 'MFA_CODE_INVALID', 'The authentication code is invalid');
  user.mfaEnabled = true;
  await user.save();
  await writeAudit(req, { action: 'auth.mfa_enabled', entityType: 'user', entityId: user.id, summary: 'Multi-factor authentication enabled' });
  res.json({ message: 'Multi-factor authentication enabled' });
});

router.post('/mfa/disable', requireAuth, async (req, res) => {
  const user = await User.findById(req.user.id).select('+passwordHash +mfaSecret');
  if (!(await bcrypt.compare(String(req.body.password || ''), user.passwordHash))) return fail(res, 400, 'PASSWORD_INVALID', 'Current password is incorrect');
  user.mfaEnabled = false;
  user.mfaSecret = null;
  await user.save();
  await writeAudit(req, { action: 'auth.mfa_disabled', entityType: 'user', entityId: user.id, summary: 'Multi-factor authentication disabled' });
  res.json({ message: 'Multi-factor authentication disabled' });
});

export default router;
