import crypto from 'crypto';
import mongoose from 'mongoose';

export class ApiError extends Error {
  constructor(status, code, message, fields) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

export const asyncRoute = handler => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

export function requestId() {
  return crypto.randomUUID();
}

export function isObjectId(value) {
  return mongoose.isValidObjectId(String(value || ''));
}

export function pagination(query, { max = 100, defaultLimit = 24 } = {}) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = Math.min(max, Math.max(1, Number.parseInt(query.limit, 10) || defaultLimit));
  return { page, limit, skip: (page - 1) * limit };
}

export function paginated(items, total, page, limit) {
  return { items, meta: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) } };
}

export function safeMessage(error) {
  if (error instanceof ApiError) return error.message;
  if (error?.name === 'ValidationError') return 'Some submitted information is invalid';
  if (error?.name === 'CastError') return 'The requested record identifier is invalid';
  if (error?.code === 11000) return 'A record with the same unique information already exists';
  return 'Unexpected server error';
}
