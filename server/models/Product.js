import mongoose from 'mongoose';

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true },
    brand: { type: String, default: '', trim: true },
    model: { type: String, default: '', trim: true },
    capacity: { type: String, default: '', trim: true },
    capacityUnit: { type: String, default: 'W', trim: true },
    unit: { type: String, default: 'piece', trim: true },
    unitPrice: { type: Number, required: true, min: 0 },
    pricePerWatt: { type: Number, default: 0 },
    inverterType: { type: String, default: '' },
    image: { type: String, default: '' },
    specifications: { type: mongoose.Schema.Types.Mixed, default: {} },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
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

export const Product = mongoose.models.Product || mongoose.model('Product', productSchema);
