import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    category: {
      type: String,
      required: true,
      trim: true,
      enum: [
        "solar-panel",
        "inverter",
        "battery",
        "structure",
        "cable",
        "accessory",
        "service",
        "other",
      ],
    },
    brand: { type: String, default: "", trim: true },
    model: { type: String, default: "", trim: true },
    capacity: { type: String, default: "", trim: true },
    capacityUnit: { type: String, default: "W", trim: true },
    unit: { type: String, default: "piece", trim: true },
    unitPrice: { type: Number, required: true, min: 0 },
    pricePerWatt: { type: Number, default: 0 },
    inverterType: { type: String, default: "" },
    autoSizing: {
      enabled: { type: Boolean, default: true },
      capacityValue: { type: Number, default: 0, min: 0 },
      capacityUnit: { type: String, enum: ["W", "kW", "kWh", ""], default: "" },
      supportedSystemTypes: { type: [String], default: [] },
      phase: {
        type: String,
        enum: ["single-phase", "three-phase", "any"],
        default: "any",
      },
      minSystemKw: { type: Number, default: 0, min: 0 },
      maxSystemKw: { type: Number, default: 5000, min: 0 },
      priority: { type: Number, default: 100, min: 0 },
    },
    image: { type: String, default: "" },
    specifications: { type: mongoose.Schema.Types.Mixed, default: {} },
    active: { type: Boolean, default: true, index: true },
    effectiveFrom: { type: Date, default: Date.now },
    priceHistory: [
      {
        unitPrice: { type: Number, min: 0 },
        pricePerWatt: { type: Number, min: 0 },
        changedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          default: null,
        },
        changedAt: { type: Date, default: Date.now },
      },
    ],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret) => {
        ret.id = ret._id.toString();
        return ret;
      },
    },
  },
);

productSchema.index({ active: 1, category: 1, name: 1 });

export const Product =
  mongoose.models.Product || mongoose.model("Product", productSchema);
