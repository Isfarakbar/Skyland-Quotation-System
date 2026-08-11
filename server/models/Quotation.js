import mongoose from 'mongoose';

const lineItemSchema = new mongoose.Schema({
  productId: { type: String, default: '' },
  name: { type: String, required: true },
  description: { type: String, default: '' },
  category: { type: String, default: '' },
  unit: { type: String, default: 'job' },
  quantity: { type: Number, required: true, default: 1, min: 0 },
  unitPrice: { type: Number, required: true, default: 0, min: 0 },
  total: { type: Number, default: 0 },
  isRequired: { type: Boolean, default: false },
  isOptional: { type: Boolean, default: false },
});

const quotationSchema = new mongoose.Schema(
  {
    quotationNumber: { type: String, required: true, unique: true, trim: true, maxlength: 80, match: /^[A-Za-z0-9][A-Za-z0-9-]{2,79}$/ },
    customerId: { type: String, required: true },
    systemSize: { type: Number, required: true, min: 0.1 },
    systemType: { type: String, default: 'ongrid', trim: true, enum: ['ongrid', 'hybrid', 'offgrid'] },
    items: [lineItemSchema],
    subtotal: { type: Number, required: true, default: 0 },
    discount: { type: Number, default: 0, min: 0 },
    discountType: { type: String, default: 'percent', enum: ['percent', 'fixed'] },
    grandTotal: { type: Number, required: true, default: 0 },
    exchangeRate: { type: Number, default: 285, min: 0.01 },
    termsAndConditions: [{ type: String }],
    validityDays: { type: Number, default: 5, min: 1, max: 365 },
    notes: { type: String, default: '' },
    status: { type: String, default: 'draft', enum: ['draft', 'sent', 'accepted', 'rejected', 'expired'] },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    statusHistory: [{
      status: { type: String, enum: ['draft', 'sent', 'accepted', 'rejected', 'expired'] },
      changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      changedAt: { type: Date, default: Date.now },
    }],
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

export const Quotation = mongoose.models.Quotation || mongoose.model('Quotation', quotationSchema);
