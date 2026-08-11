import mongoose from 'mongoose';

export const USER_ROLES = ['super_admin', 'admin', 'manager', 'employee'];
export const USER_STATUSES = ['pending', 'active', 'suspended', 'rejected'];

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
    status: { type: String, enum: USER_STATUSES, default: 'pending', index: true },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    approvedAt: { type: Date, default: null },
    lastLoginAt: { type: Date, default: null },
    sessionVersion: { type: Number, default: 0 },
    passwordResetTokenHash: { type: String, select: false, default: null },
    passwordResetExpiresAt: { type: Date, select: false, default: null },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret) => {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        delete ret.passwordHash;
        delete ret.passwordResetTokenHash;
        delete ret.passwordResetExpiresAt;
        return ret;
      },
    },
  }
);

export const User = mongoose.models.User || mongoose.model('User', userSchema);
