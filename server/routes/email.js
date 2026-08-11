import express from 'express';
import * as brevo from '@getbrevo/brevo';

const router = express.Router();

// Initialize Brevo TransactionalEmailsApi
function getBrevoClient() {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    throw new Error('BREVO_API_KEY is missing from environment variables');
  }

  const apiInstance = new brevo.TransactionalEmailsApi();
  apiInstance.setApiKey(brevo.TransactionalEmailsApiApiKeys.apiKey, apiKey);
  return apiInstance;
}

// POST send quotation email via Brevo
router.post('/send-quotation', async (req, res) => {
  try {
    const { toEmail, toName, quotationNumber, systemSize, systemType, grandTotal, htmlContent } = req.body;

    if (!toEmail) {
      return res.status(400).json({ error: 'Recipient email (toEmail) is required' });
    }

    const apiInstance = getBrevoClient();
    const sendSmtpEmail = new brevo.SendSmtpEmail();

    sendSmtpEmail.subject = `Solar Quotation #${quotationNumber} — Skyland Energy`;
    sendSmtpEmail.sender = { name: 'Skyland Energy', email: 'sales@skylandenergy.pk' };
    sendSmtpEmail.to = [{ email: toEmail, name: toName || 'Valued Customer' }];

    sendSmtpEmail.htmlContent = htmlContent || `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
        <h2 style="color: #073d72;">Skyland Energy — Solar Proposal</h2>
        <p>Dear ${toName || 'Valued Customer'},</p>
        <p>Thank you for choosing Skyland Energy. Please find your solar quotation summary below:</p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Quotation Ref:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${quotationNumber}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>System Size:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${systemSize} KW (${systemType || 'On-Grid'})</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Grand Total:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee; color: #fa4c0a; font-weight: bold;">PKR ${Number(grandTotal).toLocaleString()}</td></tr>
        </table>
        <p>If you have any questions, feel free to contact our sales team.</p>
        <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
        <p style="font-size: 12px; color: #888;">Skyland Energy • Lahore, Pakistan</p>
      </div>
    `;

    const data = await apiInstance.sendTransacEmail(sendSmtpEmail);
    res.json({ message: 'Email sent successfully via Brevo', messageId: data.body ? data.body.messageId : data.messageId });
  } catch (error) {
    console.error('Brevo Email Send Error:', error);
    res.status(500).json({ error: error.message || 'Failed to send email' });
  }
});

export default router;
