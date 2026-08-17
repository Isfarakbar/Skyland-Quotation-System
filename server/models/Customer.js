import mongoose from 'mongoose';

const customerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    whatsapp: { type: String, default: '', trim: true },
    email: { type: String, default: '', trim: true },
    city: { type: String, required: true, trim: true },
    projectType: { type: String, default: 'residential', trim: true },
    serviceInterest: {
      type: String,
      enum: ['solar', 'battery-storage', 'energy-audit', 'energy-management', 'mep', 'pfi-harmonic-filters', 'operations-maintenance'],
      default: 'solar',
    },
    address: { type: String, default: '', trim: true },
    notes: { type: String, default: '', trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret) => {
        ret.id = ret._id.toString();
        return ret;
      },
    },
  }
);

export const Customer = mongoose.models.Customer || mongoose.model('Customer', customerSchema);
