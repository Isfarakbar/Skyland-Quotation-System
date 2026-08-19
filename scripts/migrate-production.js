import "dotenv/config";
import mongoose from "mongoose";
import { Quotation } from "../server/models/Quotation.js";
import { Customer } from "../server/models/Customer.js";
import { Product } from "../server/models/Product.js";
import { AutoQuoteRule } from "../server/models/AutoQuoteRule.js";
import { AUTOMATIC_QUOTE_PRODUCTS } from "../server/seed.js";
import { DEFAULT_ENGINE_RULES } from "../server/services/quotation-engine.js";

const apply = process.argv.includes("--apply");
if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is required");

await mongoose.connect(process.env.MONGODB_URI);
try {
  const before = {
    quotations: await Quotation.countDocuments(),
    customers: await Customer.countDocuments(),
    products: await Product.countDocuments(),
    quotationsMissingRevision: await Quotation.countDocuments({
      revision: { $exists: false },
    }),
    quotationsMissingAssignee: await Quotation.countDocuments({
      assignedTo: { $exists: false },
    }),
    productsMissingActive: await Product.countDocuments({
      active: { $exists: false },
    }),
    productsMissingAutoCapacity: await Product.countDocuments({
      category: { $in: ["solar-panel", "inverter", "battery"] },
      "autoSizing.capacityValue": { $in: [null, 0] },
    }),
    automaticRuleSets: await AutoQuoteRule.countDocuments({ key: "default" }),
    approvedLegacyUsersMissingVerification: await mongoose.connection
      .collection("users")
      .countDocuments({
        status: "active",
        approvedAt: { $ne: null },
        emailVerifiedAt: { $exists: false },
      }),
  };
  console.log(
    JSON.stringify({ mode: apply ? "apply" : "dry-run", before }, null, 2),
  );
  if (!apply) {
    console.log(
      "Dry run complete. Re-run with --apply only after taking a database backup.",
    );
  } else {
    await Quotation.updateMany(
      { revision: { $exists: false } },
      { $set: { revision: 1 } },
    );
    await Quotation.updateMany(
      { assignedTo: { $exists: false }, createdBy: { $ne: null } },
      [{ $set: { assignedTo: "$createdBy" } }],
    );
    await Customer.updateMany(
      { assignedTo: { $exists: false }, createdBy: { $ne: null } },
      [{ $set: { assignedTo: "$createdBy" } }],
    );
    await Product.updateMany(
      { active: { $exists: false } },
      { $set: { active: true } },
    );
    await Product.bulkWrite(
      AUTOMATIC_QUOTE_PRODUCTS.map((product) => ({
        updateOne: {
          filter: { name: product.name },
          update: { $setOnInsert: product },
          upsert: true,
        },
      })),
      { ordered: false },
    );
    const capacityProducts = await Product.find({
      category: { $in: ["solar-panel", "inverter", "battery"] },
    });
    for (const product of capacityProducts) {
      const capacityValue = Number.parseFloat(product.capacity || "0");
      if (!Number.isFinite(capacityValue) || capacityValue <= 0) continue;
      product.set("autoSizing.capacityValue", capacityValue);
      product.set("autoSizing.capacityUnit", product.capacityUnit);
      if (product.category === "inverter" && product.inverterType)
        product.set("autoSizing.supportedSystemTypes", [product.inverterType]);
      await product.save();
    }
    await AutoQuoteRule.updateOne(
      { key: "default" },
      { $setOnInsert: { ...DEFAULT_ENGINE_RULES, key: "default" } },
      { upsert: true },
    );
    await mongoose.connection
      .collection("users")
      .updateMany(
        {
          status: "active",
          approvedAt: { $ne: null },
          emailVerifiedAt: { $exists: false },
        },
        [{ $set: { emailVerifiedAt: "$approvedAt" } }],
      );
    const after = {
      quotations: await Quotation.countDocuments(),
      customers: await Customer.countDocuments(),
      products: await Product.countDocuments(),
      quotationsMissingRevision: await Quotation.countDocuments({
        revision: { $exists: false },
      }),
      quotationsMissingAssignee: await Quotation.countDocuments({
        assignedTo: { $exists: false },
      }),
      productsMissingActive: await Product.countDocuments({
        active: { $exists: false },
      }),
      productsMissingAutoCapacity: await Product.countDocuments({
        category: { $in: ["solar-panel", "inverter", "battery"] },
        "autoSizing.capacityValue": { $in: [null, 0] },
      }),
      automaticRuleSets: await AutoQuoteRule.countDocuments({ key: "default" }),
      approvedLegacyUsersMissingVerification: await mongoose.connection
        .collection("users")
        .countDocuments({
          status: "active",
          approvedAt: { $ne: null },
          emailVerifiedAt: { $exists: false },
        }),
    };
    if (
      before.quotations !== after.quotations ||
      before.customers !== after.customers ||
      after.products < before.products ||
      after.automaticRuleSets !== 1 ||
      after.productsMissingAutoCapacity !== 0
    )
      throw new Error(
        "Record count or automatic quotation backfill verification failed",
      );
    console.log(JSON.stringify({ mode: "complete", after }, null, 2));
  }
} finally {
  await mongoose.disconnect();
}
