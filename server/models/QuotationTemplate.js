import mongoose from 'mongoose';

const templateSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  description: { type: String, default: '', trim: true, maxlength: 500 },
  systemType: { type: String, enum: ['ongrid', 'hybrid', 'offgrid'], default: 'ongrid' },
  items: { type: [mongoose.Schema.Types.Mixed], default: [] },
  defaults: { type: mongoose.Schema.Types.Mixed, default: {} },
  active: { type: Boolean, default: true, index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true, toJSON: { transform: (_doc, ret) => { ret.id = ret._id.toString(); delete ret._id; delete ret.__v; return ret; } } });

export const QuotationTemplate = mongoose.models.QuotationTemplate || mongoose.model('QuotationTemplate', templateSchema);
