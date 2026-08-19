import mongoose from "mongoose";

const boqRuleSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, trim: true },
    label: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true },
    productName: { type: String, default: "", trim: true },
    basis: {
      type: String,
      enum: ["fixed", "per_panel", "per_kw", "per_inverter", "per_battery"],
      default: "fixed",
    },
    multiplier: { type: Number, default: 1, min: 0 },
    unit: { type: String, default: "job", trim: true },
    unitPrice: { type: Number, default: 0, min: 0 },
    priceMode: {
      type: String,
      enum: ["catalog", "rule", "included", "survey"],
      default: "catalog",
    },
    optional: { type: Boolean, default: false },
    enabled: { type: Boolean, default: true },
  },
  { _id: false },
);

const autoQuoteRuleSchema = new mongoose.Schema(
  {
    key: { type: String, unique: true, default: "default" },
    engineVersion: { type: String, default: "1.0" },
    panelMarginPercent: { type: Number, default: 0, min: 0, max: 50 },
    inverterOversizePercent: { type: Number, default: 15, min: 0, max: 100 },
    batteryDodPercent: { type: Number, default: 90, min: 1, max: 100 },
    inverterEfficiencyPercent: { type: Number, default: 95, min: 1, max: 100 },
    batteryReservePercent: { type: Number, default: 10, min: 0, max: 100 },
    defaultRoofType: { type: String, default: "rcc" },
    boqRules: { type: [boqRuleSchema], default: [] },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true },
);

export const AutoQuoteRule =
  mongoose.models.AutoQuoteRule ||
  mongoose.model("AutoQuoteRule", autoQuoteRuleSchema);
