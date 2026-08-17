import express from 'express';
import { rateLimit } from 'express-rate-limit';
import { sendEmail } from '../services/email.js';
import { Quotation } from '../models/Quotation.js';
import { Customer } from '../models/Customer.js';

const router = express.Router();
const emailLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 20, standardHeaders: 'draft-7', legacyHeaders: false });
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));

router.post('/send-quotation', emailLimiter, async (req, res) => {
  try {
    const quotation = await Quotation.findById(req.body.quotationId);
    if (!quotation) return res.status(404).json({ error: 'Quotation not found' });
    if (req.user.role === 'employee' && quotation.createdBy && quotation.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Employees can email quotations they created only' });
    }
    const customer = await Customer.findById(quotation.customerId);
    if (!customer?.email || !/^\S+@\S+\.\S+$/.test(customer.email)) {
      return res.status(400).json({ error: 'Add a valid email address to this customer before sending' });
    }

    const data = await sendEmail({
      subject: `Solar Quotation #${quotation.quotationNumber} — Skyland Energy`,
      to: customer.email,
      name: customer.name || 'Valued Customer',
      html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;border:1px solid #e5e7eb;border-radius:8px">
        <h2 style="color:#073d72">Skyland Energy — Solar Proposal</h2>
        <p>Dear ${escapeHtml(customer.name || 'Valued Customer')},</p>
        <p>Thank you for choosing Skyland Energy. Your quotation summary is below.</p>
        <table style="width:100%;border-collapse:collapse;margin:20px 0">
          <tr><td style="padding:8px;border-bottom:1px solid #eee"><strong>Quotation Ref:</strong></td><td style="padding:8px;border-bottom:1px solid #eee">${escapeHtml(quotation.quotationNumber)}</td></tr>
          <tr><td style="padding:8px;border-bottom:1px solid #eee"><strong>System Size:</strong></td><td style="padding:8px;border-bottom:1px solid #eee">${escapeHtml(quotation.systemSize)} KW (${escapeHtml(quotation.systemType)})</td></tr>
          <tr><td style="padding:8px;border-bottom:1px solid #eee"><strong>Grand Total:</strong></td><td style="padding:8px;border-bottom:1px solid #eee;color:#fa4c0a;font-weight:bold">PKR ${Number(quotation.grandTotal).toLocaleString('en-PK')}</td></tr>
        </table>
        <p>Please contact our sales team for the full proposal or any requested adjustments.</p>
        <hr style="border:0;border-top:1px solid #eee;margin:20px 0" />
        <p style="font-size:12px;color:#666">Skyland Energy (Pvt.) Ltd · 286 H-1, Johar Town, Lahore · +92 42 32353019 · theskylandenergy.com</p>
      </div>`,
    });

    if (quotation.status === 'draft') {
      quotation.status = 'sent';
      quotation.updatedBy = req.user.id;
      quotation.statusHistory.push({ status: 'sent', changedBy: req.user.id });
      await quotation.save();
    }

    res.json({
      message: 'Quotation email sent successfully',
      messageId: data.body?.messageId || data.messageId,
      status: quotation.status,
    });
  } catch (error) {
    console.error('Quotation email send error:', error.message);
    res.status(500).json({ error: process.env.NODE_ENV === 'production' ? 'Failed to send quotation email' : error.message });
  }
});

export default router;
