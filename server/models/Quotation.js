import mongoose from "mongoose";

const lineItemSchema = new mongoose.Schema({
  productId: { type: String, default: "" },
  name: { type: String, required: true },
  description: { type: String, default: "" },
  category: { type: String, default: "" },
  unit: { type: String, default: "job" },
  quantity: { type: Number, required: true, default: 1, min: 0 },
  unitPrice: { type: Number, required: true, default: 0, min: 0 },
  total: { type: Number, default: 0 },
  isRequired: { type: Boolean, default: false },
  isOptional: { type: Boolean, default: false },
});

const paymentMilestoneSchema = new mongoose.Schema(
  {
    label: { type: String, required: true, trim: true, maxlength: 120 },
    percent: { type: Number, required: true, min: 0, max: 100 },
  },
  { _id: false },
);

const warrantySchema = new mongoose.Schema(
  {
    panels: {
      type: String,
      default: "As per manufacturer warranty",
      trim: true,
      maxlength: 250,
    },
    inverter: {
      type: String,
      default: "As per manufacturer warranty",
      trim: true,
      maxlength: 250,
    },
    battery: {
      type: String,
      default: "As per manufacturer warranty",
      trim: true,
      maxlength: 250,
    },
    workmanship: {
      type: String,
      default: "1 year workmanship warranty",
      trim: true,
      maxlength: 250,
    },
  },
  { _id: false },
);

const quotationSchema = new mongoose.Schema(
  {
    quotationNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      maxlength: 80,
      match: /^[A-Za-z0-9][A-Za-z0-9-]{2,79}$/,
    },
    customerId: { type: String, required: true },
    systemSize: { type: Number, required: true, min: 0.1 },
    systemType: {
      type: String,
      default: "ongrid",
      trim: true,
      enum: ["ongrid", "hybrid", "offgrid"],
    },
    disco: { type: String, default: "", trim: true, maxlength: 80 },
    sanctionedLoad: { type: Number, default: 0, min: 0 },
    meterPhase: {
      type: String,
      default: "unknown",
      enum: ["single-phase", "three-phase", "unknown"],
    },
    roofType: {
      type: String,
      default: "rcc",
      enum: ["rcc", "metal-shed", "ground-mount", "other"],
    },
    monthlyUnits: { type: Number, default: 0, min: 0 },
    monthlyBill: { type: Number, default: 0, min: 0 },
    prosumerIncluded: { type: Boolean, default: false },
    siteSurveyStatus: {
      type: String,
      default: "required",
      enum: ["required", "completed", "not-required"],
    },
    items: [lineItemSchema],
    subtotal: { type: Number, required: true, default: 0 },
    discount: { type: Number, default: 0, min: 0 },
    discountType: {
      type: String,
      default: "percent",
      enum: ["percent", "fixed"],
    },
    taxLabel: {
      type: String,
      default: "Applicable taxes",
      trim: true,
      maxlength: 100,
    },
    taxRate: { type: Number, default: 0, min: 0, max: 100 },
    taxAmount: { type: Number, default: 0, min: 0 },
    grandTotal: { type: Number, required: true, default: 0 },
    exchangeRate: { type: Number, default: 285, min: 0.01 },
    termsAndConditions: [{ type: String }],
    validityDays: { type: Number, default: 5, min: 1, max: 365 },
    notes: { type: String, default: "" },
    installationDays: { type: Number, default: 7, min: 1, max: 365 },
    paymentSchedule: {
      type: [paymentMilestoneSchema],
      default: () => [
        { label: "Advance with order", percent: 20 },
        { label: "Equipment delivery / installation", percent: 70 },
        { label: "Testing and commissioning", percent: 10 },
      ],
    },
    warranty: { type: warrantySchema, default: () => ({}) },
    status: {
      type: String,
      default: "draft",
      enum: [
        "draft",
        "pending_approval",
        "approved",
        "sent",
        "viewed",
        "accepted",
        "rejected",
        "expired",
        "cancelled",
      ],
      index: true,
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    followUpAt: { type: Date, default: null, index: true },
    followUpNote: { type: String, default: "", trim: true, maxlength: 500 },
    templateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "QuotationTemplate",
      default: null,
    },
    revision: { type: Number, default: 1, min: 1 },
    revisionOf: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Quotation",
      default: null,
      index: true,
    },
    approval: {
      requestedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
      requestedAt: { type: Date, default: null },
      decidedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
      decidedAt: { type: Date, default: null },
      note: { type: String, default: "", trim: true, maxlength: 500 },
    },
    commercialSnapshot: { type: mongoose.Schema.Types.Mixed, default: {} },
    generation: { type: mongoose.Schema.Types.Mixed, default: null },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    statusHistory: [
      {
        status: {
          type: String,
          enum: [
            "draft",
            "pending_approval",
            "approved",
            "sent",
            "viewed",
            "accepted",
            "rejected",
            "expired",
            "cancelled",
          ],
        },
        changedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          default: null,
        },
        changedAt: { type: Date, default: Date.now },
        note: { type: String, default: "", trim: true, maxlength: 500 },
      },
    ],
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

quotationSchema.index({ createdBy: 1, createdAt: -1 });
quotationSchema.index({ assignedTo: 1, createdAt: -1 });
quotationSchema.index({ status: 1, followUpAt: 1 });
quotationSchema.index({ customerId: 1, createdAt: -1 });

export const Quotation =
  mongoose.models.Quotation || mongoose.model("Quotation", quotationSchema);
