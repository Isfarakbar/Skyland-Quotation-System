import express from "express";
import { hasPermission } from "../middleware/auth.js";
import { AutoQuoteRule } from "../models/AutoQuoteRule.js";
import { writeAudit } from "../models/AuditLog.js";
import {
  DEFAULT_ENGINE_RULES,
  generateQuotationPreview,
  getEngineRules,
  getQuotationOptions,
} from "../services/quotation-engine.js";

const router = express.Router();
const denied = (res, permission) =>
  res
    .status(403)
    .json({
      error: { code: "FORBIDDEN", message: `${permission} access is required` },
    });

router.get("/options", async (req, res) => {
  if (!hasPermission(req.user, "auto_quote_generate"))
    return denied(res, "Automatic quotation");
  res.json(
    await getQuotationOptions({
      systemSizeKw: req.query.systemSizeKw,
      systemType: req.query.systemType || "ongrid",
    }),
  );
});

router.post("/preview", async (req, res) => {
  if (!hasPermission(req.user, "auto_quote_generate"))
    return denied(res, "Automatic quotation");
  res.json(await generateQuotationPreview(req.body));
});

router.get("/rules", async (req, res) => {
  if (!hasPermission(req.user, "auto_quote_rules_manage"))
    return denied(res, "Automatic quotation rules");
  res.json(await getEngineRules());
});

router.put("/rules", async (req, res) => {
  if (!hasPermission(req.user, "auto_quote_rules_manage"))
    return denied(res, "Automatic quotation rules");
  const allowed = [
    "panelMarginPercent",
    "inverterOversizePercent",
    "batteryDodPercent",
    "inverterEfficiencyPercent",
    "batteryReservePercent",
    "defaultRoofType",
    "boqRules",
  ];
  const update = Object.fromEntries(
    allowed
      .filter((key) => req.body[key] !== undefined)
      .map((key) => [key, req.body[key]]),
  );
  const rules = await AutoQuoteRule.findOneAndUpdate(
    { key: "default" },
    {
      $set: {
        ...DEFAULT_ENGINE_RULES,
        ...update,
        key: "default",
        updatedBy: req.user.id,
      },
    },
    { upsert: true, returnDocument: "after", runValidators: true },
  );
  await writeAudit(req, {
    action: "auto_quote.rules_updated",
    entityType: "setting",
    entityId: rules.id,
    summary: "Updated automatic quotation sizing rules",
  });
  res.json(rules);
});

export default router;
