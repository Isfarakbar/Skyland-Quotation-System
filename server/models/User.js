import mongoose from 'mongoose';

export const USER_ROLES = ['super_admin', 'admin', 'manager', 'employee'];
export const USER_STATUSES = ['pending', 'active', 'suspended', 'rejected'];
export const USER_PERMISSION_KEYS = [
  'products_manage', 'products_delete', 'rates_view', 'rates_manage',
  'customers_manage_all', 'customers_delete', 'quotations_manage_all',
  'quotations_delete', 'quotations_send_all', 'settings_manage',
  'customers_view_all', 'customers_delete_own', 'customers_delete_all',
  'quotations_view_all', 'quotations_delete_own', 'quotations_delete_all',
  'quotations_approve', 'exports_manage', 'users_view_sensitive',
  'users_manage_permissions', 'security_manage', 'audit_view',
];

const allPermissions = Object.fromEntries(USER_PERMISSION_KEYS.map(key => [key, true]));
export const ROLE_PERMISSION_DEFAULTS = {
  super_admin: allPermissions,
  admin: allPermissions,
  manager: {
    products_manage: true, products_delete: false, rates_view: true, rates_manage: true,
    customers_manage_all: true, customers_delete: true, quotations_manage_all: true,
    quotations_delete: true, quotations_send_all: true, settings_manage: true,
    customers_view_all: true, customers_delete_own: true, customers_delete_all: true,
    quotations_view_all: true, quotations_delete_own: true, quotations_delete_all: true,
    quotations_approve: true, exports_manage: true, users_view_sensitive: false,
    users_manage_permissions: false, security_manage: false, audit_view: false,
  },
  employee: Object.fromEntries(USER_PERMISSION_KEYS.map(key => [key, false])),
};

export function getEffectivePermissions(user) {
  const overrides = user?.permissions instanceof Map ? Object.fromEntries(user.permissions) : (user?.permissions || {});
  const effective = { ...(ROLE_PERMISSION_DEFAULTS[user?.role] || {}), ...overrides };
  if (effective.rates_manage) effective.rates_view = true;
  // Preserve permissions granted before the expanded policy was introduced.
  if (effective.customers_manage_all) effective.customers_view_all = true;
  if (effective.customers_delete) effective.customers_delete_all = true;
  if (effective.quotations_manage_all) effective.quotations_view_all = true;
  if (effective.quotations_delete) effective.quotations_delete_all = true;
  return effective;
}

const userSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true, trim: true, maxlength: 60 },
    lastName: { type: String, required: true, trim: true, maxlength: 60 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    passwordHash: { type: String, required: true, select: false },
    phone: { type: String, required: true, trim: true },
    alternatePhone: { type: String, default: '', trim: true },
    dateOfBirth: { type: Date, required: true },
    gender: { type: String, enum: ['male', 'female', 'other', 'prefer_not_to_say'], required: true },
    cnic: { type: String, required: true, trim: true, unique: true },
    address: { type: String, required: true, trim: true, maxlength: 300 },
    city: { type: String, required: true, trim: true },
    department: { type: String, required: true, trim: true },
    designation: { type: String, required: true, trim: true },
    employeeId: { type: String, default: '', trim: true },
    profilePicture: { type: String, default: '' },
    emergencyContactName: { type: String, required: true, trim: true },
    emergencyContactPhone: { type: String, required: true, trim: true },
    role: { type: String, enum: USER_ROLES, default: 'employee', index: true },
    permissions: { type: Map, of: Boolean, default: () => ({}) },
    status: { type: String, enum: USER_STATUSES, default: 'pending', index: true },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    approvedAt: { type: Date, default: null },
    lastLoginAt: { type: Date, default: null },
    lastLoginIp: { type: String, default: '' },
    emailVerifiedAt: { type: Date, default: null },
    emailVerificationTokenHash: { type: String, select: false, default: null },
    emailVerificationExpiresAt: { type: Date, select: false, default: null },
    failedLoginAttempts: { type: Number, default: 0, select: false },
    lockedUntil: { type: Date, default: null, select: false },
    mfaEnabled: { type: Boolean, default: false },
    mfaSecret: { type: String, default: null, select: false },
    mfaRecoveryCodeHashes: { type: [String], default: [], select: false },
    sessionVersion: { type: Number, default: 0 },
    passwordResetTokenHash: { type: String, select: false, default: null },
    passwordResetExpiresAt: { type: Date, select: false, default: null },
  },
  {
    timestamps: true,
    toJSON: {
      flattenMaps: true,
      transform: (_doc, ret) => {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        delete ret.passwordHash;
        delete ret.passwordResetTokenHash;
        delete ret.passwordResetExpiresAt;
        delete ret.emailVerificationTokenHash;
        delete ret.emailVerificationExpiresAt;
        delete ret.failedLoginAttempts;
        delete ret.lockedUntil;
        delete ret.mfaSecret;
        delete ret.mfaRecoveryCodeHashes;
        ret.effectivePermissions = getEffectivePermissions(ret);
        return ret;
      },
    },
  }
);

export const User = mongoose.models.User || mongoose.model('User', userSchema);
