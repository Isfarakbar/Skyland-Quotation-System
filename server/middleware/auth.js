import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';

export const AUTH_COOKIE = 'skyland_session';

export function signSession(user) {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET must be configured with at least 32 characters');
  }
  return jwt.sign({ sub: user.id, role: user.role, ver: user.sessionVersion || 0 }, process.env.JWT_SECRET, { expiresIn: '7d' });
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL),
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  };
}

export async function requireAuth(req, res, next) {
  try {
    const bearer = req.get('authorization')?.startsWith('Bearer ')
      ? req.get('authorization').slice(7)
      : null;
    const token = req.cookies?.[AUTH_COOKIE] || bearer;
    if (!token) return res.status(401).json({ error: 'Authentication required' });

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.sub);
    if (!user || user.status !== 'active' || (user.sessionVersion || 0) !== (payload.ver || 0)) {
      return res.status(401).json({ error: 'Your account is not active' });
    }
    req.user = user;
    next();
  } catch (_error) {
    return res.status(401).json({ error: 'Session expired or invalid' });
  }
}

export function allowRoles(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'You do not have permission to perform this action' });
    }
    next();
  };
}
