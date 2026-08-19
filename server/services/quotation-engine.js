import crypto from "crypto";
import { Product } from "../models/Product.js";
import { AutoQuoteRule } from "../models/AutoQuoteRule.js";

export const DEFAULT_BOQ_RULES = [
  {
    key: "structure",
    label: "Mounting Structure L-2 & L-1 GI",
    category: "structure",
    productName: "Mounting Structure L-2 & L-1 GI",
    basis: "per_panel",
    multiplier: 1,
    unit: "set",
    priceMode: "catalog",
    enabled: true,
  },
  {
    key: "db",
    label: "DB Box & Breakers",
    category: "accessory",
    productName: "DB Box & Breakers",
    basis: "fixed",
    multiplier: 1,
    unit: "job",
    priceMode: "catalog",
    enabled: true,
  },
  {
    key: "pvc",
    label: "PVC Material & Accessories",
    category: "accessory",
    productName: "PVC Material & Accessories",
    basis: "fixed",
    multiplier: 1,
    unit: "job",
    priceMode: "catalog",
    enabled: true,
  },
  {
    key: "dc-cable",
    label: "DC Cable (XLPO/XLPO)",
    category: "cable",
    productName: "DC Cable (XLPO/XLPO)",
    basis: "fixed",
    multiplier: 1,
    unit: "job",
    priceMode: "catalog",
    enabled: true,
  },
  {
    key: "ac-cable",
    label: "AC Cable (Copper)",
    category: "cable",
    productName: "AC Cable (Copper)",
    basis: "fixed",
    multiplier: 1,
    unit: "job",
    priceMode: "catalog",
    enabled: true,
  },
  {
    key: "earthing",
    label: "Earthing & boring",
    category: "service",
    basis: "fixed",
    multiplier: 3,
    unit: "point",
    unitPrice: 20000,
    priceMode: "rule",
    enabled: true,
  },
  {
    key: "lightning",
    label: "Lightning Arrester",
    category: "accessory",
    productName: "Lightning Arrester",
    basis: "fixed",
    multiplier: 1,
    unit: "piece",
    priceMode: "catalog",
    enabled: true,
  },
  {
    key: "civil",
    label: "Civil works and foundations",
    category: "service",
    basis: "fixed",
    multiplier: 1,
    unit: "job",
    priceMode: "survey",
    enabled: true,
  },
  {
    key: "engineering",
    label: "Engineering, design, supervision, testing & commissioning",
    category: "service",
    basis: "fixed",
    multiplier: 1,
    unit: "job",
    priceMode: "included",
    enabled: true,
  },
  {
    key: "installation",
    label: "Installation, electrification & wiring",
    category: "service",
    basis: "fixed",
    multiplier: 1,
    unit: "job",
    priceMode: "included",
    enabled: true,
  },
  {
    key: "transport",
    label: "Transportation and travelling",
    category: "service",
    basis: "fixed",
    multiplier: 1,
    unit: "job",
    priceMode: "survey",
    enabled: true,
  },
  {
    key: "after-sales",
    label: "One year after-sales service",
    category: "service",
    basis: "fixed",
    multiplier: 1,
    unit: "job",
    priceMode: "included",
    enabled: true,
  },
  {
    key: "prosumer",
    label: "Prosumer application and commissioning support",
    category: "service",
    basis: "fixed",
    multiplier: 1,
    unit: "job",
    priceMode: "survey",
    optional: true,
    enabled: true,
  },
];

export const DEFAULT_ENGINE_RULES = {
  engineVersion: "1.0",
  panelMarginPercent: 0,
  inverterOversizePercent: 15,
  batteryDodPercent: 90,
  inverterEfficiencyPercent: 95,
  batteryReservePercent: 10,
  defaultRoofType: "rcc",
  boqRules: DEFAULT_BOQ_RULES,
};

const numericCapacity = (product) => {
  const explicit = Number(product.autoSizing?.capacityValue || 0);
  return explicit > 0 ? explicit : Number.parseFloat(product.capacity || "0");
};
const capacityUnit = (product) =>
  product.autoSizing?.capacityUnit || product.capacityUnit || "";
const brandKey = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();
const round = (value, decimals = 3) => Number(Number(value).toFixed(decimals));
const itemFromProduct = (product, quantity, description = "") => ({
  productId: product.id || product._id.toString(),
  name: product.name,
  description,
  category: product.category,
  unit: product.unit || "piece",
  quantity: round(quantity),
  unitPrice: Number(product.unitPrice || 0),
  total: round(quantity * Number(product.unitPrice || 0), 2),
  isRequired: true,
});

function eligible(product, systemType, systemSizeKw) {
  if (product.active === false || product.autoSizing?.enabled === false)
    return false;
  const min = Number(product.autoSizing?.minSystemKw || 0);
  const max = Number(product.autoSizing?.maxSystemKw || 5000);
  if (systemSizeKw < min || systemSizeKw > max) return false;
  const supported = product.autoSizing?.supportedSystemTypes || [];
  if (supported.length && !supported.includes(systemType)) return false;
  if (
    product.category === "inverter" &&
    product.inverterType &&
    product.inverterType !== systemType
  )
    return false;
  return numericCapacity(product) > 0;
}

function choosePanel(products, brand, requiredWatts) {
  const candidates = products
    .filter(
      (p) =>
        p.category === "solar-panel" &&
        brandKey(p.brand) === brandKey(brand) &&
        capacityUnit(p) === "W",
    )
    .map((product) => {
      const capacity = numericCapacity(product);
      const quantity = Math.ceil(requiredWatts / capacity);
      return {
        product,
        capacity,
        quantity,
        actual: quantity * capacity,
        price: quantity * Number(product.unitPrice || 0),
      };
    })
    .sort(
      (a, b) =>
        a.actual - b.actual ||
        a.quantity - b.quantity ||
        a.price - b.price ||
        Number(a.product.autoSizing?.priority || 100) -
          Number(b.product.autoSizing?.priority || 100),
    );
  return candidates[0];
}

function chooseCapacityCombination(
  products,
  category,
  brand,
  target,
  maxOversizePercent,
  systemType,
) {
  const models = products
    .filter(
      (p) =>
        p.category === category &&
        brandKey(p.brand) === brandKey(brand) &&
        eligible(p, systemType, target),
    )
    .map((product) => ({ product, capacity: numericCapacity(product) }))
    .sort((a, b) => b.capacity - a.capacity);
  const maxCapacity = target * (1 + maxOversizePercent / 100) + 0.0001;
  const candidates = [];
  const addCandidate = (choices) => {
    const usable = choices.filter((choice) => choice.quantity > 0);
    const actual = usable.reduce(
      (sum, choice) => sum + choice.capacity * choice.quantity,
      0,
    );
    if (actual < target || actual > maxCapacity) return;
    candidates.push({
      choices: usable,
      actual,
      excess: actual - target,
      quantity: usable.reduce((sum, choice) => sum + choice.quantity, 0),
      price: usable.reduce(
        (sum, choice) =>
          sum + choice.quantity * Number(choice.product.unitPrice || 0),
        0,
      ),
    });
  };
  for (let first = 0; first < models.length; first += 1) {
    const a = models[first];
    addCandidate([{ ...a, quantity: Math.ceil(target / a.capacity) }]);
    for (let second = first + 1; second < models.length; second += 1) {
      const b = models[second];
      const maxA = Math.ceil(maxCapacity / a.capacity);
      for (let quantityA = 0; quantityA <= maxA; quantityA += 1) {
        const remaining = Math.max(0, target - quantityA * a.capacity);
        addCandidate([
          { ...a, quantity: quantityA },
          { ...b, quantity: Math.ceil(remaining / b.capacity) },
        ]);
      }
    }
  }
  return candidates.sort(
    (a, b) =>
      a.quantity - b.quantity || a.excess - b.excess || a.price - b.price,
  )[0];
}

function boqQuantity(rule, design) {
  const base = {
    fixed: 1,
    per_panel: design.panelQuantity,
    per_kw: design.requestedAcKw,
    per_inverter: design.inverterQuantity,
    per_battery: design.batteryQuantity,
  }[rule.basis || "fixed"];
  return round(base * Number(rule.multiplier ?? 1));
}

export async function getEngineRules() {
  const stored = await AutoQuoteRule.findOne({ key: "default" }).lean();
  return stored
    ? {
        ...DEFAULT_ENGINE_RULES,
        ...stored,
        boqRules: stored.boqRules?.length ? stored.boqRules : DEFAULT_BOQ_RULES,
      }
    : DEFAULT_ENGINE_RULES;
}

export async function getQuotationOptions({ systemSizeKw, systemType }) {
  const size = Number(systemSizeKw);
  if (!Number.isFinite(size) || size < 0.1 || size > 5000)
    return { panelBrands: [], inverterBrands: [], batteryBrands: [] };
  const products = await Product.find({
    active: { $ne: false },
    category: { $in: ["solar-panel", "inverter", "battery"] },
  }).lean();
  const rules = await getEngineRules();
  const unique = (category, filter = () => true) =>
    [
      ...new Set(
        products
          .filter(
            (p) =>
              p.category === category &&
              eligible(p, systemType, size) &&
              filter(p),
          )
          .map((p) => p.brand)
          .filter(Boolean),
      ),
    ].sort();
  const inverterBrands = unique("inverter").filter((brand) =>
    chooseCapacityCombination(
      products,
      "inverter",
      brand,
      size,
      Number(rules.inverterOversizePercent),
      systemType,
    ),
  );
  return {
    panelBrands: unique("solar-panel", (p) => capacityUnit(p) === "W"),
    inverterBrands,
    batteryBrands: unique("battery", (p) => capacityUnit(p) === "kWh"),
  };
}

export async function generateQuotationPreview(input) {
  const systemSizeKw = Number(input.systemSizeKw);
  if (
    !Number.isFinite(systemSizeKw) ||
    systemSizeKw < 0.1 ||
    systemSizeKw > 5000
  ) {
    const error = new Error("System size must be between 0.1 kW and 5 MW");
    error.status = 400;
    error.code = "SYSTEM_SIZE_INVALID";
    throw error;
  }
  if (!["ongrid", "hybrid", "offgrid"].includes(input.systemType)) {
    const error = new Error("Select a valid system type");
    error.status = 400;
    error.code = "SYSTEM_TYPE_INVALID";
    throw error;
  }
  if (!input.panelBrand || !input.inverterBrand) {
    const error = new Error("Select panel and inverter companies");
    error.status = 400;
    error.code = "BRANDS_REQUIRED";
    throw error;
  }
  const rules = await getEngineRules();
  const products = await Product.find({ active: { $ne: false } }).lean();
  const requiredPanelWatts =
    systemSizeKw * 1000 * (1 + Number(rules.panelMarginPercent) / 100);
  const panel = choosePanel(products, input.panelBrand, requiredPanelWatts);
  if (!panel) {
    const error = new Error(
      `No automatically sized panel is available for ${input.panelBrand}`,
    );
    error.status = 409;
    error.code = "PANEL_UNAVAILABLE";
    throw error;
  }
  const inverter = chooseCapacityCombination(
    products,
    "inverter",
    input.inverterBrand,
    systemSizeKw,
    Number(rules.inverterOversizePercent),
    input.systemType,
  );
  if (!inverter) {
    const error = new Error(
      `No compatible ${input.inverterBrand} ${input.systemType} inverter combination is available for ${systemSizeKw} kW`,
    );
    error.status = 409;
    error.code = "INVERTER_UNAVAILABLE";
    throw error;
  }

  const needsBattery =
    input.systemType !== "ongrid" || Boolean(input.includeBattery);
  let battery = null;
  let requiredBatteryKwh = 0;
  if (needsBattery) {
    const backupLoadKw = Number(input.backupLoadKw);
    const backupHours = Number(input.backupHours);
    if (
      !input.batteryBrand ||
      !Number.isFinite(backupLoadKw) ||
      backupLoadKw <= 0 ||
      !Number.isFinite(backupHours) ||
      backupHours <= 0
    ) {
      const error = new Error(
        "Select a battery company and enter backup load and hours",
      );
      error.status = 400;
      error.code = "BACKUP_REQUIREMENTS_INVALID";
      throw error;
    }
    requiredBatteryKwh =
      ((backupLoadKw * backupHours) /
        (Number(rules.batteryDodPercent) / 100) /
        (Number(rules.inverterEfficiencyPercent) / 100)) *
      (1 + Number(rules.batteryReservePercent) / 100);
    battery = chooseCapacityCombination(
      products,
      "battery",
      input.batteryBrand,
      requiredBatteryKwh,
      1000,
      input.systemType,
    );
    if (!battery) {
      const error = new Error(
        `No usable battery model is available for ${input.batteryBrand}`,
      );
      error.status = 409;
      error.code = "BATTERY_UNAVAILABLE";
      throw error;
    }
  }

  const design = {
    requestedAcKw: round(systemSizeKw),
    panelModel: panel.product.model,
    panelWatts: panel.capacity,
    panelQuantity: panel.quantity,
    actualDcKw: round(panel.actual / 1000),
    inverterModel: inverter.choices
      .map((choice) => choice.product.model)
      .join(" + "),
    inverterUnitKw:
      inverter.choices.length === 1 ? inverter.choices[0].capacity : 0,
    inverterQuantity: inverter.quantity,
    inverterTotalKw: round(inverter.actual),
    inverterBreakdown: inverter.choices.map((choice) => ({
      model: choice.product.model,
      capacity: choice.capacity,
      quantity: choice.quantity,
    })),
    requiredBatteryKwh: round(requiredBatteryKwh),
    batteryModel:
      battery?.choices.map((choice) => choice.product.model).join(" + ") || "",
    batteryUnitKwh:
      battery?.choices.length === 1 ? battery.choices[0].capacity : 0,
    batteryQuantity: battery?.quantity || 0,
    batteryTotalKwh: round(battery?.actual || 0),
    batteryBreakdown:
      battery?.choices.map((choice) => ({
        model: choice.product.model,
        capacity: choice.capacity,
        quantity: choice.quantity,
      })) || [],
  };
  const items = [
    itemFromProduct(
      panel.product,
      panel.quantity,
      `${panel.capacity} W each · ${design.actualDcKw} kW DC array`,
    ),
    ...inverter.choices.map((choice) =>
      itemFromProduct(
        choice.product,
        choice.quantity,
        `${choice.capacity} kW each · ${design.inverterTotalKw} kW combined inverter capacity`,
      ),
    ),
    ...(battery
      ? battery.choices.map((choice) =>
          itemFromProduct(
            choice.product,
            choice.quantity,
            `${choice.capacity} kWh each · ${design.batteryTotalKwh} kWh nominal storage`,
          ),
        )
      : []),
  ];
  for (const rule of rules.boqRules.filter(
    (row) => row.enabled !== false && (!row.optional || input.prosumerIncluded),
  )) {
    const quantity = boqQuantity(rule, design);
    if (quantity <= 0) continue;
    const product = rule.productName
      ? products.find((p) => p.active !== false && p.name === rule.productName)
      : null;
    const unitPrice =
      rule.priceMode === "catalog"
        ? Number(product?.unitPrice || rule.unitPrice || 0)
        : rule.priceMode === "rule"
          ? Number(rule.unitPrice || 0)
          : 0;
    const note =
      rule.priceMode === "included"
        ? "Included in project scope"
        : rule.priceMode === "survey"
          ? "Provisional scope — final price subject to site survey"
          : "Automatically calculated standard scope";
    items.push({
      productId: product?._id?.toString() || "",
      name: rule.label,
      description: note,
      category: rule.category,
      unit: rule.unit || product?.unit || "job",
      quantity,
      unitPrice,
      total: round(quantity * unitPrice, 2),
      isRequired: !rule.optional,
      isOptional: Boolean(rule.optional),
    });
  }
  const subtotal = round(
    items.reduce((sum, item) => sum + item.total, 0),
    2,
  );
  const latestProductUpdate = products.reduce(
    (latest, product) =>
      Math.max(
        latest,
        new Date(product.updatedAt || product.createdAt || 0).getTime(),
      ),
    0,
  );
  const normalizedInput = {
    systemSizeKw,
    systemType: input.systemType,
    panelBrand: input.panelBrand,
    inverterBrand: input.inverterBrand,
    includeBattery: needsBattery,
    batteryBrand: needsBattery ? input.batteryBrand : "",
    backupLoadKw: needsBattery ? Number(input.backupLoadKw) : 0,
    backupHours: needsBattery ? Number(input.backupHours) : 0,
    roofType: input.roofType || rules.defaultRoofType,
    prosumerIncluded: Boolean(input.prosumerIncluded),
  };
  const base = {
    engineVersion: rules.engineVersion,
    catalogVersion: String(latestProductUpdate),
    rulesVersion: String(
      rules.updatedAt ? new Date(rules.updatedAt).getTime() : "default",
    ),
    input: normalizedInput,
    design,
    items,
    subtotal,
    assumptions: [
      `${String(normalizedInput.roofType).toUpperCase()} roof and standard cable routes assumed`,
      "Structure, cable routes, civil work, transport and installation remain subject to site survey",
      "Catalog prices are preserved when the quotation is saved",
    ],
    warnings: items
      .filter((item) => item.description?.includes("subject to site survey"))
      .map((item) => `${item.name}: final price subject to site survey`),
  };
  return {
    ...base,
    digest: crypto
      .createHash("sha256")
      .update(JSON.stringify(base))
      .digest("hex"),
  };
}
