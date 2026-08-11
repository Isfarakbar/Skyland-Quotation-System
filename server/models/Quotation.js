import mongoose from 'mongoose';

const lineItemSchema = new mongoose.Schema({
  productId: { type: String, default: '' },
  name: { type: String, required: true },
  description: { type: String, default: '' },
  category: { type: String, default: '' },
  unit: { type: String, default: 'job' },
  quantity: { type: Number, required: true, default: 1 },
  unitPrice: { type: Number, required: true, default: 0 },
  total: { type: Number, default: 0 },
  isRequired: { type: Boolean, default: false },
  isOptional: { type: Boolean, default: false },
});

const quotationSchema = new mongoose.Schema(
  {
    quotationNumber: { type: String, required: true, unique: true, trim: true },
    customerId: { type: String, required: true },
    systemSize: { type: Number, required: true },
    systemType: { type: String, default: 'ongrid', trim: true },
    items: [lineItemSchema],
    subtotal: { type: Number, required: true, default: 0 },
    discount: { type: Number, default: 0 },
    discountType: { type: String, default: 'percent' },
    grandTotal: { type: Number, required: true, default: 0 },
    exchangeRate: { type: Number, default: 285 },
    termsAndConditions: [{ type: String }],
    validityDays: { type: Number, default: 5 },
    notes: { type: String, default: '' },
    status: { type: String, default: 'draft', enum: ['draft', 'sent', 'accepted', 'rejected', 'expired'] },
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
