import { BrevoClient } from '@getbrevo/brevo';

export function getBrevoClient() {
  if (!process.env.BREVO_API_KEY) throw new Error('BREVO_API_KEY is not configured');
  return new BrevoClient({ apiKey: process.env.BREVO_API_KEY, timeoutInSeconds: 20, maxRetries: 2 }).transactionalEmails;
}

export async function sendEmail({ to, name, subject, html }) {
  if (process.env.EMAIL_DISABLED === '1') return { messageId: 'email-disabled' };
  return getBrevoClient().sendTransacEmail({
    subject,
    sender: {
      name: process.env.EMAIL_FROM_NAME || 'Skyland Energy',
      email: process.env.EMAIL_FROM_ADDRESS || 'info@theskylandenergy.com',
    },
    to: [{ email: to, name: name || 'Skyland Team Member' }],
    htmlContent: html,
  });
}
