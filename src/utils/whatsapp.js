// ============================================
// SKYLAND ENERGY — WhatsApp Integration
// ============================================
import { formatWhatsAppNumber, formatCurrency } from './helpers.js';

// Open WhatsApp with customer
export function openWhatsApp(phone, message = '') {
  const number = formatWhatsAppNumber(phone);
  if (!number) {
    alert('No WhatsApp number provided');
    return;
  }
  const encodedMessage = encodeURIComponent(message);
  const url = `https://wa.me/${number}${message ? '?text=' + encodedMessage : ''}`;
  window.open(url, '_blank');
}

// Send greeting to customer
export function sendGreeting(customerName, phone) {
  const message = `Assalam o Alaikum ${customerName},\n\nThis is from Skyland Energy. Thank you for your interest in solar energy solutions.\n\nHow can we assist you today?\n\nRegards,\nSkyland Energy Team`;
  openWhatsApp(phone, message);
}

// Send quotation summary via WhatsApp
export function sendQuotationWhatsApp(customer, quotation) {
  const systemType = quotation.systemType === 'ongrid' ? 'On-Grid'
    : quotation.systemType === 'hybrid' ? 'Hybrid' : 'Off-Grid';

  const message = `Assalam o Alaikum ${customer.name},

Thank you for your interest in Skyland Energy's solar solutions.

Please find your quotation details:
📋 Ref: ${quotation.quotationNumber}
⚡ System: ${quotation.systemSize}KW ${systemType}
💰 Total: ${formatCurrency(quotation.grandTotal)}

Quotation is valid for ${quotation.validityDays || 5} days from the date of issue.

We look forward to working with you!

Regards,
Skyland Energy Team
📞 Contact us for any queries`;

  openWhatsApp(customer.whatsapp || customer.phone, message);
}
