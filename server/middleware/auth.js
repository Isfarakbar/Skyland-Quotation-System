import crypto from 'crypto';
import { User, getEffectivePermissions } from '../models/User.js';
import { Session } from '../models/Session.js';

export const AUTH_COOKIE = 'skyland_session';
export const CSRF_COOKIE = 'skyland_csrf';
const SESSION_DAYS = 7;
const hashToken = token => crypto.createHash('sha256').update(String(token || '')).digest('hex');

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL),
    sameSite: 'strict',
    path: '/',
    maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000,
  };
}

export function csrfCookieOptions() {
  return {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL),
    sameSite: 'strict',
    path: '/',
    maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000,
  };
}

export async function createSession(user, req) {
  const token = crypto.randomBytes(32).toString('base64url');
  const session = await Session.create({
    tokenHash: hashToken(token),
    userId: user.id,
    expiresAt: new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000),
    ip: req.ip || '',
    userAgent: req.get('user-agent') || '',
  });
  return { token, session };
}

export const createCsrfToken = () => crypto.randomBytes(24).toString('base64url');

export async function destroySession(token) {
  if (token) await Session.deleteOne({ tokenHash: hashToken(token) });
}

export async function requireAuth(req, res, next) {
  try {
    const token = req.cookies?.[AUTH_COOKIE];
    if (!token) return res.status(401).json({ error: { code: 'AUTH_REQUIRED', message: 'Authentication required' } });
    const session = await Session.findOne({ tokenHash: hashToken(token), expiresAt: { $gt: new Date() } });
    if (!session) return res.status(401).json({ error: { code: 'SESSION_INVALID', message: 'Session expired or invalid' } });
    const user = await User.findById(session.userId);
    if (!user || user.status !== 'active') {
      await Session.deleteOne({ _id: session.id });
      return res.status(401).json({ error: { code: 'ACCOUNT_INACTIVE', message: 'Your account is not active' } });
    }
    if (Date.now() - session.updatedAt.getTime() > 5 * 60 * 1000) {
      session.lastSeenAt = new Date();
      session.save().catch(() => {});
    }
    req.user = user;
    req.session = session;
    next();
  } catch (error) {
    next(error);
  }
}

export function requireCsrf(req, res, next) {
  if (/^\/auth\/(login|register|forgot-password|reset-password|verify-email|resend-verification)$/.test(req.path) || req.path === '/uploads/registration-profile') return next();
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method) || !req.cookies?.[AUTH_COOKIE] || !req.get('origin')) return next();
  const cookieToken = String(req.cookies?.[CSRF_COOKIE] || '');
  const headerToken = String(req.get('x-csrf-token') || '');
  if (!cookieToken || !headerToken || cookieToken.length !== headerToken.length) {
    return res.status(403).json({ error: { code: 'CSRF_INVALID', message: 'Security token is missing or invalid. Refresh the page and try again.' } });
  }
  if (!crypto.timingSafeEqual(Buffer.from(cookieToken), Buffer.from(headerToken))) {
    return res.status(403).json({ error: { code: 'CSRF_INVALID', message: 'Security token is missing or invalid. Refresh the page and try again.' } });
  }
  next();
}

export function allowRoles(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'You do not have permission to perform this action' } });
    next();
  };
}

export function hasPermission(user, permission) {
  return Boolean(getEffectivePermissions(user)[permission]);
}

export function allowPermission(permission) {
  return (req, res, next) => {
    if (!req.user || !hasPermission(req.user, permission)) return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'You do not have permission to perform this action' } });
    next();
  };
}
