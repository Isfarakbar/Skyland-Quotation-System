import express from "express";
import { rateLimit } from "express-rate-limit";
import { sendEmail } from "../services/email.js";
import { Quotation } from "../models/Quotation.js";
import { Customer } from "../models/Customer.js";
import { hasPermission } from "../middleware/auth.js";
import { isObjectId } from "../lib/api.js";
import { writeAudit } from "../models/AuditLog.js";

const router = express.Router();
const emailLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
});
const escapeHtml = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[char],
  );

router.post("/send-quotation", emailLimiter, async (req, res) => {
  try {
    if (!isObjectId(req.body.quotationId))
      return res
        .status(400)
        .json({
          error: {
            code: "QUOTATION_INVALID",
            message: "Select a valid quotation to email",
          },
        });
    const quotation = await Quotation.findById(req.body.quotationId);
    if (!quotation)
      return res
        .status(404)
        .json({
          error: {
            code: "QUOTATION_NOT_FOUND",
            message: "Quotation not found",
          },
        });
    const ownsQuotation = [quotation.createdBy, quotation.assignedTo].some(
      (value) => value?.toString() === req.user.id,
    );
    if (!hasPermission(req.user, "quotations_send_all") && !ownsQuotation) {
      return res
        .status(403)
        .json({
          error: {
            code: "FORBIDDEN",
            message: "You can email quotations assigned to you only",
          },
        });
    }
    const customer = await Customer.findById(quotation.customerId);
    if (!customer?.email || !/^\S+@\S+\.\S+$/.test(customer.email)) {
      return res
        .status(400)
        .json({
          error: {
            code: "CUSTOMER_EMAIL_REQUIRED",
            message:
              "Add a valid email address to this customer before sending",
          },
        });
    }
    if (
      ["pending_approval", "rejected", "expired", "cancelled"].includes(
        quotation.status,
      )
    )
      return res
        .status(409)
        .json({
          error: {
            code: "QUOTATION_NOT_SENDABLE",
            message: `A ${quotation.status.replace("_", " ")} quotation cannot be emailed`,
          },
        });

    const itemRows = quotation.items
      .map(
        (item) =>
          `<tr><td style="padding:8px;border-bottom:1px solid #eee">${escapeHtml(item.name)}</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:center">${escapeHtml(item.quantity)} ${escapeHtml(item.unit)}</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:right">PKR ${Number(item.unitPrice).toLocaleString("en-PK")}</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:right">PKR ${Number(item.total ?? item.quantity * item.unitPrice).toLocaleString("en-PK")}</td></tr>`,
      )
      .join("");

    const data = await sendEmail({
      subject: `Solar Quotation #${quotation.quotationNumber} — Skyland Energy`,
      to: customer.email,
      name: customer.name || "Valued Customer",
      html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;border:1px solid #e5e7eb;border-radius:8px">
        <h2 style="color:#073d72">Skyland Energy — Solar Proposal</h2>
        <p>Dear ${escapeHtml(customer.name || "Valued Customer")},</p>
        <p>Thank you for choosing Skyland Energy. Your quotation summary is below.</p>
        <table style="width:100%;border-collapse:collapse;margin:20px 0">
          <tr><td style="padding:8px;border-bottom:1px solid #eee"><strong>Quotation Ref:</strong></td><td style="padding:8px;border-bottom:1px solid #eee">${escapeHtml(quotation.quotationNumber)}</td></tr>
          <tr><td style="padding:8px;border-bottom:1px solid #eee"><strong>System Size:</strong></td><td style="padding:8px;border-bottom:1px solid #eee">${escapeHtml(quotation.systemSize)} KW (${escapeHtml(quotation.systemType)})</td></tr>
          <tr><td style="padding:8px;border-bottom:1px solid #eee"><strong>Grand Total:</strong></td><td style="padding:8px;border-bottom:1px solid #eee;color:#fa4c0a;font-weight:bold">PKR ${Number(quotation.grandTotal).toLocaleString("en-PK")}</td></tr>
        </table>
        <table style="width:100%;border-collapse:collapse;margin:20px 0">
          <thead><tr style="background:#073d72;color:#fff"><th style="padding:8px;text-align:left">Product / service</th><th style="padding:8px">Quantity</th><th style="padding:8px;text-align:right">Rate</th><th style="padding:8px;text-align:right">Total</th></tr></thead>
          <tbody>${itemRows}</tbody>
        </table>
        <p><strong>Validity:</strong> ${escapeHtml(quotation.validityDays)} days &nbsp; <strong>Installation:</strong> ${escapeHtml(quotation.installationDays)} days</p>
        ${quotation.notes ? `<p><strong>Notes:</strong> ${escapeHtml(quotation.notes)}</p>` : ""}
        <p>Please contact our sales team for adjustments or acceptance of this proposal.</p>
        <hr style="border:0;border-top:1px solid #eee;margin:20px 0" />
        <p style="font-size:12px;color:#666">Skyland Energy (Pvt.) Ltd · 286 H-1, Johar Town, Lahore · +92 42 32353019 · theskylandenergy.com</p>
      </div>`,
    });

    if (["draft", "approved"].includes(quotation.status)) {
      quotation.status = "sent";
      quotation.updatedBy = req.user.id;
      quotation.statusHistory.push({ status: "sent", changedBy: req.user.id });
      await quotation.save();
    }
    await writeAudit(req, {
      action: "quotation.emailed",
      entityType: "quotation",
      entityId: quotation.id,
      summary: `Emailed ${quotation.quotationNumber} to ${customer.email}`,
    });

    res.json({
      message: "Quotation email sent successfully",
      messageId: data.body?.messageId || data.messageId,
      status: quotation.status,
    });
  } catch (error) {
    console.error("Quotation email send error:", error.message);
    res
      .status(502)
      .json({
        error: {
          code: "EMAIL_DELIVERY_FAILED",
          message:
            process.env.NODE_ENV === "production"
              ? "The email provider could not deliver this quotation. Try again shortly."
              : error.message,
        },
      });
  }
});

export default router;
