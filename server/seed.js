import { Product } from "./models/Product.js";
import { Setting } from "./models/Setting.js";
import { DEFAULT_TERMS, DEFAULT_SETTINGS } from "../src/db/seed-data.js";
import bcrypt from "bcryptjs";
import { User } from "./models/User.js";

const BOOTSTRAP_VERSION = "2026-08-19-capacity-quotation-v1";

const INITIAL_PRODUCTS = [
  {
    name: "Trina N-Type Bifacial Solar Panel",
    category: "solar-panel",
    brand: "Trina",
    model: "Vertex N 725W",
    capacity: "725",
    capacityUnit: "W",
    unit: "piece",
    unitPrice: 27913,
    pricePerWatt: 38.5,
    specifications: {
      Technology: "N-Type Bifacial",
      Warranty: "25 Years",
      Efficiency: "22.5%",
    },
  },
  {
    name: "Canadian N-Type Bifacial Solar Panel",
    category: "solar-panel",
    brand: "Canadian Solar",
    model: "HiKu7 CS7N 715W",
    capacity: "715",
    capacityUnit: "W",
    unit: "piece",
    unitPrice: 29673,
    pricePerWatt: 41.5,
    specifications: { Technology: "N-Type Bifacial", Warranty: "25 Years" },
  },
  {
    name: "Risen HJT Solar Panel",
    category: "solar-panel",
    brand: "Risen",
    model: "HJT 740W",
    capacity: "740",
    capacityUnit: "W",
    unit: "piece",
    unitPrice: 31080,
    pricePerWatt: 42.0,
    specifications: {
      Technology: "HJT (Heterojunction)",
      Warranty: "30 Years",
    },
  },
  {
    name: "Longi Himo X10 Solar Panel",
    category: "solar-panel",
    brand: "Longi",
    model: "Himo X10 645W",
    capacity: "645",
    capacityUnit: "W",
    unit: "piece",
    unitPrice: 26768,
    pricePerWatt: 41.5,
    specifications: { Technology: "N-Type Bifacial", Warranty: "25 Years" },
  },
  {
    name: "Jinko N-Type Bifacial Solar Panel",
    category: "solar-panel",
    brand: "Jinko",
    model: "Tiger Neo 725W",
    capacity: "725",
    capacityUnit: "W",
    unit: "piece",
    unitPrice: 29725,
    pricePerWatt: 41.0,
    specifications: { Technology: "N-Type Bifacial", Warranty: "25 Years" },
  },
  {
    name: "JA N-Type Bifacial Solar Panel",
    category: "solar-panel",
    brand: "JA Solar",
    model: "DeepBlue 4.0 Pro 585W",
    capacity: "585",
    capacityUnit: "W",
    unit: "piece",
    unitPrice: 24263,
    pricePerWatt: 41.5,
    specifications: { Technology: "N-Type Bifacial", Warranty: "25 Years" },
  },
  // Inverters
  {
    name: "Huawei On-Grid Inverter 10KTL",
    category: "inverter",
    brand: "Huawei",
    model: "SUN2000-10KTL",
    capacity: "10",
    capacityUnit: "kW",
    unit: "piece",
    unitPrice: 250000,
    inverterType: "ongrid",
    specifications: { Type: "On-Grid", Phase: "3-Phase", Warranty: "10 Years" },
  },
  {
    name: "Huawei On-Grid Inverter 15KTL",
    category: "inverter",
    brand: "Huawei",
    model: "SUN2000-15KTL",
    capacity: "15",
    capacityUnit: "kW",
    unit: "piece",
    unitPrice: 310000,
    inverterType: "ongrid",
    specifications: { Type: "On-Grid", Phase: "3-Phase", Warranty: "10 Years" },
  },
  {
    name: "Huawei On-Grid Inverter 20KTL",
    category: "inverter",
    brand: "Huawei",
    model: "SUN2000-20KTL",
    capacity: "20",
    capacityUnit: "kW",
    unit: "piece",
    unitPrice: 330000,
    inverterType: "ongrid",
    specifications: { Type: "On-Grid", Phase: "3-Phase", Warranty: "10 Years" },
  },
  {
    name: "Huawei On-Grid Inverter 30KTL",
    category: "inverter",
    brand: "Huawei",
    model: "SUN2000-30KTL",
    capacity: "30",
    capacityUnit: "kW",
    unit: "piece",
    unitPrice: 560000,
    inverterType: "ongrid",
    specifications: { Type: "On-Grid", Phase: "3-Phase", Warranty: "10 Years" },
  },
  {
    name: "GoodWe On-Grid Inverter 15kW",
    category: "inverter",
    brand: "GoodWe",
    model: "GW15KN-DT",
    capacity: "15",
    capacityUnit: "kW",
    unit: "piece",
    unitPrice: 210000,
    inverterType: "ongrid",
    specifications: { Type: "On-Grid", Phase: "3-Phase", Warranty: "10 Years" },
  },
  {
    name: "GoodWe 3-Ph Hybrid Inverter 12kW",
    category: "inverter",
    brand: "GoodWe",
    model: "GW12K-ET",
    capacity: "12",
    capacityUnit: "kW",
    unit: "piece",
    unitPrice: 500000,
    inverterType: "hybrid",
    specifications: { Type: "Hybrid", Phase: "3-Phase", Warranty: "10 Years" },
  },
  // Batteries
  {
    name: "GoodWe Lithium Battery 5kWh",
    category: "battery",
    brand: "GoodWe",
    model: "Lynx Home U 5.0",
    capacity: "5",
    capacityUnit: "kWh",
    unit: "piece",
    unitPrice: 265000,
    specifications: { Chemistry: "LiFePO4", Warranty: "10 Years" },
  },
  {
    name: "Soluna Lithium Battery 16kWh",
    category: "battery",
    brand: "Soluna",
    model: "16kWh IP65",
    capacity: "16",
    capacityUnit: "kWh",
    unit: "piece",
    unitPrice: 685000,
    specifications: {
      Chemistry: "LiFePO4",
      Rating: "IP65",
      Warranty: "10 Years",
    },
  },
  // Structures & Accessories & Cables
  {
    name: "Mounting Structure L-2 & L-1 GI",
    category: "structure",
    brand: "GI Standard",
    model: "L-2 & L-1 (12 SWG)",
    unit: "set",
    unitPrice: 6600,
    specifications: { Material: "Galvanized Iron", Gauge: "12 SWG" },
  },
  {
    name: "DB Box & Breakers",
    category: "accessory",
    brand: "Chint / CNC",
    model: "Standard",
    unit: "job",
    unitPrice: 28600,
    specifications: { Brand: "Chint or CNC" },
  },
  {
    name: "PVC Material & Accessories",
    category: "accessory",
    brand: "Popular / GM",
    model: "Pipes, Ducts, Cable Ties",
    unit: "job",
    unitPrice: 21099,
  },
  {
    name: "Lightning Arrester",
    category: "accessory",
    brand: "Standard",
    model: "Lightning Protection",
    unit: "piece",
    unitPrice: 14500,
  },
  {
    name: "DC Cable (XLPO/XLPO)",
    category: "cable",
    brand: "Imported",
    model: "4mm-6mm XLPO/XLPO",
    unit: "job",
    unitPrice: 32500,
  },
  {
    name: "AC Cable (Copper)",
    category: "cable",
    brand: "Fast / Newage / GM",
    model: "Copper AC Cable",
    unit: "job",
    unitPrice: 7150,
  },
];

export const AUTOMATIC_QUOTE_PRODUCTS = [
  {
    name: "Huawei On-Grid Inverter 50KTL",
    category: "inverter",
    brand: "Huawei",
    model: "SUN2000-50KTL",
    capacity: "50",
    capacityUnit: "kW",
    unit: "piece",
    unitPrice: 560000,
    inverterType: "ongrid",
    specifications: { Type: "On-Grid", Phase: "3-Phase", Warranty: "10 Years" },
  },
  {
    name: "Huawei On-Grid Inverter 115KTL",
    category: "inverter",
    brand: "Huawei",
    model: "SUN2000-115KTL",
    capacity: "115",
    capacityUnit: "kW",
    unit: "piece",
    unitPrice: 1260000,
    inverterType: "ongrid",
    specifications: { Type: "On-Grid", Phase: "3-Phase", Warranty: "10 Years" },
  },
  {
    name: "GoodWe 3-Ph Hybrid Inverter 50kW",
    category: "inverter",
    brand: "GoodWe",
    model: "GW50K-ET",
    capacity: "50",
    capacityUnit: "kW",
    unit: "piece",
    unitPrice: 1420000,
    inverterType: "hybrid",
    specifications: { Type: "Hybrid", Phase: "3-Phase", Warranty: "10 Years" },
  },
  {
    name: "GoodWe Lithium Battery 14.3kWh",
    category: "battery",
    brand: "GoodWe",
    model: "Lynx Home U 14.3",
    capacity: "14.3",
    capacityUnit: "kWh",
    unit: "piece",
    unitPrice: 700000,
    specifications: { Chemistry: "LiFePO4", Warranty: "10 Years" },
  },
  {
    name: "Soluna Lithium Battery 5kWh",
    category: "battery",
    brand: "Soluna",
    model: "5kWh IP65",
    capacity: "5",
    capacityUnit: "kWh",
    unit: "piece",
    unitPrice: 270000,
    specifications: {
      Chemistry: "LiFePO4",
      Rating: "IP65",
      Warranty: "10 Years",
    },
  },
  {
    name: "Soluna Lithium Battery 32kWh",
    category: "battery",
    brand: "Soluna",
    model: "32kWh IP65",
    capacity: "32",
    capacityUnit: "kWh",
    unit: "piece",
    unitPrice: 1365000,
    specifications: {
      Chemistry: "LiFePO4",
      Rating: "IP65",
      Warranty: "10 Years",
    },
  },
];

export async function seedMongoDB() {
  try {
    // Vercel may create many short-lived function instances. Avoid repeating
    // catalog counts, settings upserts, and account checks on every cold start.
    const completedBootstrap = await Setting.exists({
      key: "systemBootstrapVersion",
      value: BOOTSTRAP_VERSION,
    });
    if (completedBootstrap) return;

    const productCount = await Product.countDocuments();
    if (productCount === 0) {
      await Product.insertMany(INITIAL_PRODUCTS);
      console.log(
        `🌱 Seeded ${INITIAL_PRODUCTS.length} initial products to MongoDB`,
      );
    }

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
    await Promise.all(
      capacityProducts.map((product) => {
        const value = Number.parseFloat(product.capacity || "0");
        if (!Number.isFinite(value) || value <= 0) return null;
        product.autoSizing = {
          ...(product.autoSizing?.toObject?.() || product.autoSizing || {}),
          enabled: product.autoSizing?.enabled !== false,
          capacityValue: value,
          capacityUnit: product.capacityUnit,
          supportedSystemTypes:
            product.category === "inverter" && product.inverterType
              ? [product.inverterType]
              : [],
          phase: String(product.specifications?.Phase || "")
            .toLowerCase()
            .includes("3")
            ? "three-phase"
            : "any",
        };
        return product.save();
      }),
    );

    await Setting.bulkWrite(
      Object.entries(DEFAULT_SETTINGS).map(([key, value]) => ({
        updateOne: {
          filter: { key },
          update: { $setOnInsert: { key, value } },
          upsert: true,
        },
      })),
      { ordered: false },
    );

    // Upgrade untouched placeholder company values while preserving user customizations.
    const verifiedCompanyDefaults = {
      companyName: ["Skyland Energy", DEFAULT_SETTINGS.companyName],
      companyAddress: ["", "Lahore, Pakistan", DEFAULT_SETTINGS.companyAddress],
      companyPhone: ["", DEFAULT_SETTINGS.companyPhone],
      companyEmail: ["", DEFAULT_SETTINGS.companyEmail],
    };
    await Promise.all(
      Object.entries(verifiedCompanyDefaults).map(([key, acceptedValues]) =>
        Setting.updateOne(
          { key, value: { $in: acceptedValues.slice(0, -1) } },
          { $set: { value: acceptedValues.at(-1) } },
        ),
      ),
    );

    const superAdminEmail = process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase();
    const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD;
    if (
      superAdminEmail &&
      superAdminPassword &&
      !(await User.exists({ role: "super_admin" }))
    ) {
      if (superAdminPassword.length < 10)
        throw new Error("SUPER_ADMIN_PASSWORD must be at least 10 characters");
      await User.create({
        firstName: process.env.SUPER_ADMIN_FIRST_NAME || "Skyland",
        lastName: process.env.SUPER_ADMIN_LAST_NAME || "Administrator",
        email: superAdminEmail,
        passwordHash: await bcrypt.hash(superAdminPassword, 12),
        phone: process.env.SUPER_ADMIN_PHONE || "00000000000",
        dateOfBirth: new Date("1990-01-01"),
        gender: "prefer_not_to_say",
        cnic: process.env.SUPER_ADMIN_CNIC || "BOOTSTRAP-SUPER-ADMIN",
        address: process.env.SUPER_ADMIN_ADDRESS || "Skyland Energy",
        city: process.env.SUPER_ADMIN_CITY || "Lahore",
        department: "Administration",
        designation: "Super Administrator",
        emergencyContactName: "Skyland Energy",
        emergencyContactPhone: process.env.SUPER_ADMIN_PHONE || "00000000000",
        role: "super_admin",
        status: "active",
        approvedAt: new Date(),
      });
      console.log("Created the initial super admin account");
    }

    await Setting.updateOne(
      { key: "systemBootstrapVersion" },
      { $set: { value: BOOTSTRAP_VERSION } },
      { upsert: true },
    );
  } catch (error) {
    console.error("❌ Error seeding MongoDB:", error);
  }
}
